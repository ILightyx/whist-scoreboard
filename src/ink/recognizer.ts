// Runs the digit model (public/models/digits.json, trained by
// model/train_digits.py): a small int8-quantised MLP, 784 -> 512 -> 256 -> 10.
// Plain TypeScript; no ML library needed.

import { IMAGE_SIZE, rasterize, splitDigits, type Stroke } from './raster';

interface Layer {
  inputs: number;
  outputs: number;
  weights: Int8Array;
  scales: Float32Array;
  bias: Float32Array;
}

export interface DigitModel {
  layers: Layer[];
}

interface ModelFile {
  format: string;
  version: number;
  layers: { inputs: number; outputs: number; weights: string; scales: string; bias: string }[];
}

function decode(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function parseModel(file: ModelFile): DigitModel {
  if (file.format !== 'scorekeeper-digits' || file.version !== 1) throw new Error('Unknown digit model format');
  return {
    layers: file.layers.map((layer) => ({
      inputs: layer.inputs,
      outputs: layer.outputs,
      weights: new Int8Array(decode(layer.weights)),
      scales: new Float32Array(decode(layer.scales)),
      bias: new Float32Array(decode(layer.bias)),
    })),
  };
}

let modelPromise: Promise<DigitModel> | null = null;

/** Loads the model once (it is precached for offline use). */
export function loadModel(url = `${import.meta.env.BASE_URL}models/digits.json`): Promise<DigitModel> {
  modelPromise ??= fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Digit model: HTTP ${response.status}`);
      return response.json() as Promise<ModelFile>;
    })
    .then(parseModel)
    .catch((error: unknown) => {
      modelPromise = null;
      throw error;
    });
  return modelPromise;
}

/** Probabilities for digits 0..9. */
export function classify(model: DigitModel, image: Float32Array): Float32Array {
  let activations: Float32Array = image;
  model.layers.forEach((layer, layerIndex) => {
    const out = new Float32Array(layer.outputs);
    for (let o = 0; o < layer.outputs; o++) {
      let sum = 0;
      for (let i = 0; i < layer.inputs; i++) {
        const a = activations[i];
        if (a !== 0) sum += a * layer.weights[i * layer.outputs + o];
      }
      const value = sum * layer.scales[o] + layer.bias[o];
      out[o] = layerIndex < model.layers.length - 1 ? Math.max(0, value) : value;
    }
    activations = out;
  });
  const max = Math.max(...activations);
  const exps = activations.map((value) => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

export interface Candidate {
  value: number;
  confidence: number;
}

/**
 * Reads the number written in a cell. Only values 0..max (except `banned`) are
 * possible, which makes small cells (a 1-card round allows 0 or 1) very reliable.
 * Returns candidates best-first, with confidences that sum to 1.
 */
export function recognize(model: DigitModel, strokes: Stroke[], max: number, banned: number | null = null): Candidate[] {
  if (!strokes.length) return [];
  const allowed = (value: number) => value >= 0 && value <= max && value !== banned;
  const groups = max >= 10 ? splitDigits(strokes) : [strokes];
  if (groups.length === 2) {
    // Two digits side by side, e.g. "10" or "12".
    const tens = classify(model, rasterize(groups[0]));
    const ones = classify(model, rasterize(groups[1]));
    const candidates: Candidate[] = [];
    for (let t = 1; t <= 9; t++) {
      for (let o = 0; o <= 9; o++) {
        const value = t * 10 + o;
        if (allowed(value)) candidates.push({ value, confidence: tens[t] * ones[o] });
      }
    }
    return normalise(candidates);
  }
  const probs = classify(model, rasterize(strokes));
  const candidates: Candidate[] = [];
  for (let digit = 0; digit <= 9; digit++) {
    if (allowed(digit)) candidates.push({ value: digit, confidence: probs[digit] });
  }
  return normalise(candidates);
}

function normalise(candidates: Candidate[]): Candidate[] {
  const total = candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) || 1;
  return candidates
    .map((candidate) => ({ value: candidate.value, confidence: candidate.confidence / total }))
    .sort((a, b) => b.confidence - a.confidence);
}

export { IMAGE_SIZE };
