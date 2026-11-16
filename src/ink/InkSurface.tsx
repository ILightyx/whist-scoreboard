import { useEffect, useRef, useState } from 'react';
import { countInk, loadSettings } from '../storage/db';
import { isScratchOut, isTap } from './gestures';
import type { Point, Stroke } from './raster';
import { type Candidate, loadModel, recognize } from './recognizer';

/** Recognise this long after the pen lifts (lets you add a second stroke, e.g. a 4 or a 7). */
const RECOGNIZE_DELAY_MS = 450;
/** Below this confidence the best guesses are offered as chips instead. */
const ACCEPT_CONFIDENCE = 0.85;
/** Touches this soon after the pen are treated as the palm and ignored. */
const PALM_WINDOW_MS = 1500;

let lastPenActivity = 0;

interface InkSurfaceProps {
  /** Receives the raw strokes before recognition (used by the handwriting check). */
  onStrokes?: (strokes: Stroke[]) => void;
  max: number;
  banned: number | null;
  label: string;
  onRecognized: (value: number) => void;
  onClear: () => void;
  onTap: () => void;
}

/** Transparent canvas over a cell that turns handwriting into a number. */
export function InkSurface({ max, banned, label, onRecognized, onClear, onTap, onStrokes }: InkSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<{ id: number; stroke: Stroke; ink: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer.current);
    };
  }, []);

  const clearInk = () => {
    strokes.current = [];
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const pointFrom = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const drawSegment = (from: Point, to: Point, pressure: number) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.strokeStyle = getComputedStyle(canvasRef.current!).color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 1.6 + (pressure || 0.5) * 2.6;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };

  const finishWriting = async () => {
    const written = strokes.current;
    if (!written.length) return;
    onStrokes?.(written);
    try {
      const model = await loadModel();
      const results = recognize(model, written, max, banned);
      clearInk();
      if (!results.length) return;
      if (results[0].confidence >= ACCEPT_CONFIDENCE) {
        setCandidates([]);
        countInk('accepted');
        onRecognized(results[0].value);
      } else {
        setCandidates(results.slice(0, 3));
      }
    } catch {
      // No model (e.g. first load offline failed): fall back to the number pad.
      clearInk();
      onTap();
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const isPen = event.pointerType === 'pen';
    if (event.pointerType === 'touch' && Date.now() - lastPenActivity < PALM_WINDOW_MS) return;
    const ink = isPen || event.pointerType === 'mouse' || loadSettings().fingerWriting;
    if (isPen) lastPenActivity = Date.now();
    window.clearTimeout(timer.current);
    setCandidates([]);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some pointers can't be captured; the stroke still works inside the cell.
    }
    const point = pointFrom(event);
    active.current = { id: event.pointerId, stroke: [point], ink };
    if (ink) drawSegment(point, point, event.pressure);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = active.current;
    if (!current || current.id !== event.pointerId) return;
    if (event.pointerType === 'pen') lastPenActivity = Date.now();
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const events = coalesced && coalesced.length ? coalesced : [event.nativeEvent];
    for (const sample of events) {
      const point = pointFrom(sample);
      const previous = current.stroke[current.stroke.length - 1];
      current.stroke.push(point);
      if (current.ink) drawSegment(previous, point, sample.pressure);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = active.current;
    if (!current || current.id !== event.pointerId) return;
    active.current = null;
    if (strokes.current.length === 0 && isTap(current.stroke)) {
      clearInk();
      onTap();
      return;
    }
    if (!current.ink) return;
    if (strokes.current.length === 0 && isScratchOut(current.stroke)) {
      clearInk();
      onClear();
      return;
    }
    strokes.current.push(current.stroke);
    timer.current = window.setTimeout(finishWriting, RECOGNIZE_DELAY_MS);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="ink-surface"
        aria-hidden="true"
        data-ink={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          active.current = null;
        }}
      />
      {candidates.length ? (
        <div className="ink-candidates" role="group" aria-label={`Did you write… (${label})`}>
          {candidates.map((candidate) => (
            <button
              key={candidate.value}
              onClick={() => {
                setCandidates([]);
                countInk('corrected');
                onRecognized(candidate.value);
              }}
            >
              {candidate.value}
            </button>
          ))}
          <button className="secondary" onClick={() => setCandidates([])} aria-label="None of these">
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}
