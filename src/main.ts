import { Application, Assets, Sprite, Graphics, Texture } from 'pixi.js';
import { buildLayout } from './build-layout';

// ─── Worker Types (mirrored from yolos-worker.ts) ────────────────────────────

interface EnemyDescriptor {
    id:     number;
    x:      number;
    y:      number;
    width:  number;
    height: number;
}

interface WorkerPrediction {
    type:  'prediction';
    id:    number;
    x:     number;
    y:     number;
    label: string;
    score: string;
}

type WorkerOutMessage =
    | { type: 'model-loaded' }
    | WorkerPrediction;

type WorkerInMessage =
    | { type: 'predict';      image:   ImageBitmap       }
    | { type: 'predict-game'; enemies: EnemyDescriptor[] };

// ─── Enemy config ─────────────────────────────────────────────────────────────

interface EnemyRow {
    sprites: Sprite[];
    speed:   number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOTTOM_PADDING = 20;
const TOP_PADDING    = 20;
const SHIP_SPEED     = 20;
const BULLET_SPEED   = 15;
const STAR_COUNT     = 150;
const ENEMY_W        = 150;
const ENEMY_H        = 100;
const ENEMY_SPEED    = 10;

let enemyDirection: 1 | -1 = 1;

(async () => {
    // ─── App ──────────────────────────────────────────────────────────────────

    const app = new Application();
    await app.init({ background: '#000000', resizeTo: window });
    document.getElementById('pixi-container')!.appendChild(app.canvas);

    // ─── Stars ────────────────────────────────────────────────────────────────

    for (let i = 0; i < STAR_COUNT; i++) {
        const star = new Graphics();
        const size = Math.random() * 2 + 0.5;
        star.circle(0, 0, size).fill(0xffffff);
        star.x     = Math.random() * app.screen.width;
        star.y     = Math.random() * app.screen.height;
        star.alpha = Math.random() * 0.8 + 0.2;
        app.stage.addChild(star);
    }

    // ─── Assets ───────────────────────────────────────────────────────────────

    const [texInvader, texInvader2, texInvader3, texShip, texBullet] =
        await Promise.all([
            Assets.load<Texture>('/assets/invader.png'),
            Assets.load<Texture>('/assets/invader_2.png'),
            Assets.load<Texture>('/assets/invader_3.png'),
            Assets.load<Texture>('/assets/ship.png'),
            Assets.load<Texture>('/assets/shot_ship.png'),
        ]);

    // ─── Enemy rows ───────────────────────────────────────────────────────────

    function makeRow(
        texture:   Texture,
        count:     number,
        yFraction: number,
        xStart:    number,
        xStep:     number,
        speed:     number,
    ): EnemyRow {
        const sprites: Sprite[] = [];
        for (let i = 0; i < count; i++) {
            const enemy = new Sprite(texture);
            enemy.anchor.set(0.5);
            enemy.width  = ENEMY_W;
            enemy.height = ENEMY_H;
            enemy.position.set(xStart + i * xStep, app.screen.height * yFraction - TOP_PADDING);
            app.stage.addChild(enemy);
            sprites.push(enemy);
        }
        return { sprites, speed };
    }

    const rows: EnemyRow[] = [
        makeRow(texInvader,  3, 0.20, app.screen.width / 2.5, 250, ENEMY_SPEED),
        makeRow(texInvader2, 5, 0.33, app.screen.width / 3.5, 225, ENEMY_SPEED),
        makeRow(texInvader3, 7, 0.50, app.screen.width / 4.5, 200, ENEMY_SPEED),
    ];

    /**
     * Returns all living enemies as flat descriptors with a stable numeric id.
     * The id is just the iteration index — the worker echoes it back so we can
     * look up the exact sprite without a nearest-neighbour search.
     */
    function livingEnemyDescriptors(): EnemyDescriptor[] {
        const out: EnemyDescriptor[] = [];
        let id = 0;
        for (const row of rows) {
            for (const sprite of row.sprites) {
                if (sprite.parent) {
                    out.push({ id: id++, x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height });
                }
            }
        }
        return out;
    }

    /** Finds the living sprite that matches a flat id from livingEnemyDescriptors(). */
    function spriteById(id: number): Sprite | null {
        let cursor = 0;
        for (const row of rows) {
            for (const sprite of row.sprites) {
                if (sprite.parent) {
                    if (cursor === id) return sprite;
                    cursor++;
                }
            }
        }
        return null;
    }

    buildLayout(app)

    // ─── Ship & bullet ────────────────────────────────────────────────────────

    const ship = new Sprite(texShip);
    ship.anchor.set(0.5);
    ship.width  = 150;
    ship.height = 100;
    ship.position.set(app.screen.width / 2, app.screen.height - ship.height / 2 - BOTTOM_PADDING);
    app.stage.addChild(ship);

    const bullet = new Sprite(texBullet);
    bullet.anchor.set(0.5);
    bullet.width  = 60;
    bullet.height = 100;
    let bulletActive = false;

    // ─── YOLO worker ──────────────────────────────────────────────────────────

    const worker = new Worker(
        new URL('./yolos-worker.ts', import.meta.url),
        { type: 'module' },
    );
    let workerReady       = false;
    let inferenceInFlight = false;

    // ── YOLO autopilot state ─────────────────────────────────────────────────
    // When a prediction arrives, the ship steers toward that X and fires once.
    let aiTargetX:    number | null = null; // canvas-X the ship should reach
    let aiShouldFire: boolean       = false; // fire when aligned

    worker.addEventListener('message', ({ data }: MessageEvent<WorkerOutMessage>) => {
        if (data.type === 'model-loaded') {
            workerReady = true;
            console.log('🧠 YOLO model ready — predictions enabled');
            return;
        }
        if (data.type === 'prediction') {
            console.log(`📦 prediction id=${data.id} label="${data.label}" score=${data.score}% pos=(${data.x.toFixed(0)},${data.y.toFixed(0)})`);
            handleYoloPrediction(data);
        }
    });

    worker.addEventListener('error', (e) => console.error('💥 Worker error:', e.message, e));

    /**
     * Sends current enemy positions to the worker (game-state path).
     * No canvas extraction — instant and always detects the sprites correctly.
     */
    function detectEnemies(): void {
        if (!workerReady || inferenceInFlight) return;

        const enemies = livingEnemyDescriptors();
        if (enemies.length === 0) return;

        inferenceInFlight = true;
        console.log(`🔍 scanning ${enemies.length} enemies…`);

        worker.postMessage({ type: 'predict-game', enemies } satisfies WorkerInMessage);

        // Game-state path is sync in the worker; release guard after one frame
        setTimeout(() => { inferenceInFlight = false; }, 200);
    }

    function handleYoloPrediction(prediction: WorkerPrediction): void {
        // Pick the highest-confidence target each scan.
        // The ship will steer toward its X and fire once aligned.
        const scoreNum = parseFloat(prediction.score);
        if (aiTargetX === null || scoreNum > (parseFloat(prediction.score) ?? 0)) {
            aiTargetX    = prediction.x;
            aiShouldFire = true;
            console.log(`🤖 AI targeting x=${prediction.x.toFixed(0)} label="${prediction.label}" score=${prediction.score}%`);
        }
    }

    // ─── Input ────────────────────────────────────────────────────────────────

    const keys: Record<string, boolean> = {};
    window.addEventListener('keydown', (e) => { keys[e.key] = true;  });
    window.addEventListener('keyup',   (e) => { keys[e.key] = false; });

    function captureFrame(): void {
        const canvas = app.renderer.extract.canvas(app.stage) as HTMLCanvasElement;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `frame_${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // ─── Game loop ────────────────────────────────────────────────────────────

    let frameCount = 0;
    let AIScanning = false;

    app.ticker.add(() => {
        // ── Ship movement — manual keys take priority, AI steers otherwise ────

        const manualLeft  = keys['ArrowLeft']  || keys['a'] || keys['A'];
        const manualRight = keys['ArrowRight'] || keys['d'] || keys['D'];

        if (manualLeft && ship.x - SHIP_SPEED > 100) {
            ship.x -= SHIP_SPEED;
            aiTargetX = null; // player took control — cancel AI target
        } else if (manualRight && ship.x + SHIP_SPEED < app.canvas.width - 100) {
            ship.x += SHIP_SPEED;
            aiTargetX = null;
        } else if (aiTargetX !== null) {
            // AI steering: move toward target at SHIP_SPEED
            const dx = aiTargetX - ship.x;
            if (Math.abs(dx) <= SHIP_SPEED) {
                // Close enough — snap and prepare to fire
                ship.x    = aiTargetX;
                aiTargetX = null;
            } else {
                ship.x += Math.sign(dx) * SHIP_SPEED;
            }
        }

        // ── Fire bullet — manual Space or AI auto-fire when aligned ──────────

        const aiFireNow = aiShouldFire && aiTargetX === null; // aligned = target cleared
        if ((keys[' '] || aiFireNow) && !bulletActive) {
            bullet.position.set(ship.x, ship.y - 80);
            app.stage.addChild(bullet);
            bulletActive  = true;
            aiShouldFire  = false;
        }

        // ── Hotkeys ──────────────────────────────────────────────────────────

        if (keys['r'] || keys['R']) window.location.reload();
        if (keys['p'] || keys['P']) captureFrame();
        if (keys['c'] || keys['C']) AIScanning = !AIScanning;

        // ── Bullet movement & collision ───────────────────────────────────────

        if (bulletActive) {
            bullet.y -= BULLET_SPEED;

            if (bullet.y < 0) {
                app.stage.removeChild(bullet);
                bulletActive = false;
            } else {
                const bb = bullet.getBounds();
                outer: for (const row of rows) {
                    for (const enemy of row.sprites) {
                        if (!enemy.parent) continue;
                        const eb = enemy.getBounds();
                        if (bb.maxX > eb.minX && bb.minX < eb.maxX && bb.maxY > eb.minY && bb.minY < eb.maxY) {
                            app.stage.removeChild(bullet);
                            app.stage.removeChild(enemy);
                            bulletActive = false;
                            break outer;
                        }
                    }
                }
            }
        }

        // ── Enemy patrol ──────────────────────────────────────────────────────

        const allLiving = rows.flatMap((r) => r.sprites.filter((s) => s.parent));

        if (allLiving.length > 0) {
            const globalLeft  = Math.min(...allLiving.map((s) => s.x - s.width  / 2));
            const globalRight = Math.max(...allLiving.map((s) => s.x + s.width  / 2));

            if (globalRight >= app.screen.width - 10) enemyDirection = -1;
            if (globalLeft  <= 10)                    enemyDirection =  1;

            for (const row of rows) {
                const delta = row.speed * enemyDirection;
                for (const enemy of row.sprites) {
                    if (enemy.parent) enemy.x += delta;
                }
            }
        }

        // ── Periodic YOLO scan ────────────────────────────────────────────────

        if (AIScanning) {
            frameCount++;
            if (frameCount % 30 === 0) detectEnemies();
        }
    });
})();
