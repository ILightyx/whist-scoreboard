"""Train the Scorekeeper's handwritten-digit model (NumPy + Pillow only).

    python3 model/train_digits.py            # from the Scorekeeper/ folder

Downloads MNIST into model/.cache/, trains a small MLP (784 -> 512 -> 256 -> 10)
with augmentation that makes MNIST look like pen strokes (rotation, shear,
scale, stroke thickness), re-centres every digit by mass exactly like the app's
rasteriser (src/ink/raster.ts), quantises the weights to int8 and writes
public/models/digits.json for src/ink/recognizer.ts.

MNIST: Yann LeCun, Corinna Cortes, Christopher J.C. Burges, CC BY-SA 3.0.
"""

from __future__ import annotations

import base64
import gzip
import json
import math
import struct
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
OUTPUT = ROOT.parent / "public" / "models" / "digits.json"
MIRROR = "https://storage.googleapis.com/cvdf-datasets/mnist/"
FILES = {
    "train_images": "train-images-idx3-ubyte.gz",
    "train_labels": "train-labels-idx1-ubyte.gz",
    "test_images": "t10k-images-idx3-ubyte.gz",
    "test_labels": "t10k-labels-idx1-ubyte.gz",
}
LAYERS = [784, 512, 256, 10]
EPOCHS = 22
BATCH = 128
SEED = 7


def download() -> dict[str, np.ndarray]:
    CACHE.mkdir(exist_ok=True)
    data: dict[str, np.ndarray] = {}
    for key, name in FILES.items():
        path = CACHE / name
        if not path.exists():
            print(f"Downloading {name} ...", flush=True)
            urllib.request.urlretrieve(MIRROR + name, path)
        with gzip.open(path, "rb") as handle:
            raw = handle.read()
        if "images" in key:
            _, count, rows, cols = struct.unpack(">IIII", raw[:16])
            data[key] = np.frombuffer(raw, np.uint8, offset=16).reshape(count, rows, cols)
        else:
            data[key] = np.frombuffer(raw, np.uint8, offset=8)
    return data


def centre_by_mass(image: np.ndarray) -> np.ndarray:
    """Shift so the centre of mass sits at (14, 14), as the app does."""
    total = image.sum()
    if total <= 0:
        return image
    ys, xs = np.mgrid[0:28, 0:28]
    cy = (ys * image).sum() / total
    cx = (xs * image).sum() / total
    dy, dx = int(round(14 - cy)), int(round(14 - cx))
    return np.roll(np.roll(image, dy, axis=0), dx, axis=1)


def augment(image: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    pil = Image.fromarray(image)
    # Random affine: rotation, shear and scale around the centre.
    angle = math.radians(rng.uniform(-15, 15))
    shear = rng.uniform(-0.25, 0.25)
    scale = rng.uniform(0.85, 1.12)
    cos, sin = math.cos(angle), math.sin(angle)
    a, b = cos / scale, (sin + shear) / scale
    d, e = -sin / scale, cos / scale
    c = 14 - a * 14 - b * 14 + rng.uniform(-1.5, 1.5)
    f = 14 - d * 14 - e * 14 + rng.uniform(-1.5, 1.5)
    pil = pil.transform((28, 28), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BILINEAR)
    # Pen strokes have an even width: thicken or thin some samples.
    roll = rng.random()
    if roll < 0.3:
        pil = pil.filter(ImageFilter.MaxFilter(3))
    elif roll < 0.45:
        pil = pil.filter(ImageFilter.MinFilter(3))
    out = np.asarray(pil, dtype=np.float32) / 255.0
    return centre_by_mass(out)


def prepare(images: np.ndarray) -> np.ndarray:
    return np.stack([centre_by_mass(image.astype(np.float32) / 255.0) for image in images]).reshape(len(images), 784)


class Mlp:
    def __init__(self, rng: np.random.Generator) -> None:
        self.weights = [rng.normal(0, math.sqrt(2 / fan_in), (fan_in, fan_out)).astype(np.float32) for fan_in, fan_out in zip(LAYERS, LAYERS[1:])]
        self.biases = [np.zeros(fan_out, np.float32) for fan_out in LAYERS[1:]]
        self.moments = [[np.zeros_like(p), np.zeros_like(p)] for p in self.weights + self.biases]
        self.step = 0

    def forward(self, x: np.ndarray, weights=None) -> tuple[np.ndarray, list[np.ndarray]]:
        weights = weights or self.weights
        activations = [x]
        for index, (w, b) in enumerate(zip(weights, self.biases)):
            x = x @ w + b
            if index < len(weights) - 1:
                x = np.maximum(x, 0)
            activations.append(x)
        return x, activations

    def train_batch(self, x: np.ndarray, y: np.ndarray, lr: float) -> float:
        logits, activations = self.forward(x)
        logits -= logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs /= probs.sum(axis=1, keepdims=True)
        loss = -np.log(probs[np.arange(len(y)), y] + 1e-9).mean()
        grad = probs
        grad[np.arange(len(y)), y] -= 1
        grad /= len(y)
        grads_w, grads_b = [], []
        for index in reversed(range(len(self.weights))):
            grads_w.insert(0, activations[index].T @ grad)
            grads_b.insert(0, grad.sum(axis=0))
            if index > 0:
                grad = (grad @ self.weights[index].T) * (activations[index] > 0)
        self.step += 1
        for param, g, moment in zip(self.weights + self.biases, grads_w + grads_b, self.moments):
            moment[0] = 0.9 * moment[0] + 0.1 * g
            moment[1] = 0.999 * moment[1] + 0.001 * g * g
            m_hat = moment[0] / (1 - 0.9**self.step)
            v_hat = moment[1] / (1 - 0.999**self.step)
            param -= lr * m_hat / (np.sqrt(v_hat) + 1e-8)
        return float(loss)

    def accuracy(self, x: np.ndarray, y: np.ndarray, weights=None) -> float:
        logits, _ = self.forward(x, weights)
        return float((logits.argmax(axis=1) == y).mean())


def quantise(weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """int8 per output column: w ~= q * scale[col]."""
    scale = np.abs(weights).max(axis=0) / 127.0
    scale[scale == 0] = 1.0
    q = np.clip(np.round(weights / scale), -127, 127).astype(np.int8)
    return q, scale.astype(np.float32)


def main() -> None:
    rng = np.random.default_rng(SEED)
    data = download()
    train_raw, train_y = data["train_images"], data["train_labels"].astype(np.int64)
    test_x = prepare(data["test_images"])
    test_y = data["test_labels"].astype(np.int64)
    test_aug = np.stack([augment(image, rng) for image in data["test_images"]]).reshape(-1, 784)
    model = Mlp(rng)
    for epoch in range(EPOCHS):
        started = time.time()
        train_x = np.stack([augment(image, rng) for image in train_raw]).reshape(-1, 784)
        order = rng.permutation(len(train_x))
        lr = 1e-3 * (0.86**epoch)
        losses = [model.train_batch(train_x[order[i : i + BATCH]], train_y[order[i : i + BATCH]], lr) for i in range(0, len(order), BATCH)]
        print(
            f"epoch {epoch + 1}/{EPOCHS}: loss {np.mean(losses):.4f}, test {model.accuracy(test_x, test_y):.4f}, "
            f"augmented test {model.accuracy(test_aug, test_y):.4f} ({time.time() - started:.0f}s)",
            flush=True,
        )
    quantised = [quantise(w) for w in model.weights]
    dequantised = [q.astype(np.float32) * scale for q, scale in quantised]
    accuracy = model.accuracy(test_x, test_y, dequantised)
    augmented = model.accuracy(test_aug, test_y, dequantised)
    print(f"int8 model: test {accuracy:.4f}, augmented test {augmented:.4f}")
    layers = []
    for (q, scale), bias in zip(quantised, model.biases):
        layers.append({
            "inputs": int(q.shape[0]),
            "outputs": int(q.shape[1]),
            "weights": base64.b64encode(q.tobytes()).decode(),
            "scales": base64.b64encode(scale.tobytes()).decode(),
            "bias": base64.b64encode(bias.astype(np.float32).tobytes()).decode(),
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "format": "scorekeeper-digits",
        "version": 1,
        "input": "28x28 grayscale, ink=1, centred by mass (src/ink/raster.ts)",
        "testAccuracy": round(accuracy, 4),
        "augmentedTestAccuracy": round(augmented, 4),
        "layers": layers,
    }))
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB)")
    if accuracy < 0.98:
        sys.exit("Accuracy below 98%: not good enough to ship.")


if __name__ == "__main__":
    main()
