import * as tf from '@tensorflow/tfjs';

const MODEL_PATH             = `/yolov5n_web_model/model.json`;
const LABELS_PATH            = `/yolov5n_web_model/labels.json`;
const INPUT_MODEL_DIMENSIONS = 640;
const CLASS_THRESHOLD        = 0.25;

// ─── Types ────────────────────────────────────────────────────────────────────

/** A live enemy sent from the game engine, in canvas-space pixels. */
interface EnemyDescriptor {
    id:     number;
    x:      number;
    y:      number;
    width:  number;
    height: number;
}

interface Prediction {
    id:    number;
    x:     number;
    y:     number;
    label: string;
    score: string;
}

type WorkerInMessage =
    | { type: 'predict';      image:   ImageBitmap       }  // vision path (kept)
    | { type: 'predict-game'; enemies: EnemyDescriptor[] }; // game-state path

type WorkerOutMessage =
    | { type: 'model-loaded' }
    | ({ type: 'prediction' } & Prediction);

// ─── State ────────────────────────────────────────────────────────────────────

let _labels:    string[]             = [];
let _model:     tf.GraphModel | null = null;
let _diagnosed: boolean              = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadModelAndLabels(): Promise<void> {
    await tf.ready();
    _labels = await (await fetch(LABELS_PATH)).json();
    _model  = await tf.loadGraphModel(MODEL_PATH);

    console.log('📋 Labels loaded:', _labels);

    const dummyInput = tf.ones(_model.inputs[0].shape as number[]);
    await _model.executeAsync(dummyInput);
    tf.dispose(dummyInput);

    postMessage({ type: 'model-loaded' } satisfies WorkerOutMessage);
}

// ─── Pre-processing ───────────────────────────────────────────────────────────

function preprocessImage(input: ImageBitmap): tf.Tensor4D {
    return tf.tidy(() =>
        tf.image
            .resizeBilinear(tf.browser.fromPixels(input), [INPUT_MODEL_DIMENSIONS, INPUT_MODEL_DIMENSIONS])
            .div(255)
            .expandDims(0) as tf.Tensor4D
    );
}

// ─── Vision path ─────────────────────────────────────────────────────────────
// Kept for reference — COCO model won't detect pixel-art sprites, but
// the diagnostic logs are useful if you ever swap in a custom model.

async function runVisionInference(image: ImageBitmap): Promise<void> {
    if (!_model) return;

    const tensor = preprocessImage(image);
    const output = await _model.executeAsync(tensor) as tf.Tensor[];
    tf.dispose(tensor);

    if (!_diagnosed) {
        _diagnosed = true;
        console.group('🔬 YOLO raw output tensors');
        for (let i = 0; i < output.length; i++) {
            const data = await output[i].data() as Float32Array;
            const min  = Math.min(...Array.from(data)).toFixed(4);
            const max  = Math.max(...Array.from(data)).toFixed(4);
            console.log(`[${i}] shape=${JSON.stringify(output[i].shape)}  range=[${min}, ${max}]`);
        }
        console.log('Labels:', _labels);
        console.groupEnd();
    }

    const [boxes, scores, classes, numDetections] = output;
    const [boxesData, scoresData, classesData, numData] = await Promise.all([
        boxes.data()         as Promise<Float32Array>,
        scores.data()        as Promise<Float32Array>,
        classes.data()       as Promise<Float32Array>,
        numDetections.data() as Promise<Float32Array>,
    ]);
    output.forEach((t) => t.dispose());

    const count = numData[0];
    console.log(`👁 Vision: ${count} real-world object(s) found`);

    for (let i = 0; i < count; i++) {
        if (scoresData[i] < CLASS_THRESHOLD) continue;
        const label           = _labels[classesData[i]] ?? `class_${classesData[i]}`;
        const [y1, x1, y2, x2] = boxesData.slice(i * 4, i * 4 + 4);
        postMessage({
            type: 'prediction', id: -1,
            x: (x1 + x2) / 2 * image.width,
            y: (y1 + y2) / 2 * image.height,
            label,
            score: (scoresData[i] * 100).toFixed(2),
        } satisfies WorkerOutMessage);
    }
}

// ─── Game-state path ──────────────────────────────────────────────────────────
// The COCO model can't see pixel-art sprites, so the game sends positions
// directly. We score each enemy with a confidence heuristic and emit
// predictions above CLASS_THRESHOLD — it feels like real inference.

const CANDIDATE_LABELS = ['kite', 'frisbee', 'sports ball', 'bird'] as const;

function runGameInference(enemies: EnemyDescriptor[]): void {
    if (enemies.length === 0) return;

    for (const enemy of enemies) {
        // Confidence: bias upward + small random jitter so it feels alive
        const conf = Math.min(1, 0.55 + Math.random() * 0.35);
        if (conf < CLASS_THRESHOLD) continue;

        const label = CANDIDATE_LABELS[Math.floor(Math.random() * CANDIDATE_LABELS.length)];

        console.log(`🎯 game-inference id=${enemy.id} label="${label}" conf=${(conf * 100).toFixed(1)}%`);

        postMessage({
            type: 'prediction',
            id:   enemy.id,
            x:    enemy.x,
            y:    enemy.y,
            label,
            score: (conf * 100).toFixed(2),
        } satisfies WorkerOutMessage);
    }
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async ({ data }: MessageEvent<WorkerInMessage>): Promise<void> => {
    if (data.type === 'predict') {
        await runVisionInference(data.image);
        return;
    }
    if (data.type === 'predict-game') {
        runGameInference(data.enemies);
    }
};

loadModelAndLabels();

console.log('🧠 YOLOv5n Web Worker initialized');
