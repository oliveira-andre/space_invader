// layout.js
import * as PIXI from 'pixi.js';

export function buildLayout(app: PIXI.Application) {
    // Container for HUD
    const hud = new PIXI.Container();
    const labelHud = new PIXI.Container();
    hud.y = 50;
    hud.zIndex = 1000;
    labelHud.y = 36;

    // Score Text
    const scoreText = new PIXI.Text({
        text: 'Score: 0',
        style: {
            fontFamily: 'monospace',
            fontSize: 24,
            fill: 0xffffff,
            stroke: 0x000000,
        }
    });
    scoreText.y = 36;
    hud.addChild(scoreText);

    // Predictions Text
    const predictionsText = new PIXI.Text({
        text: 'Predictions:',
        style: {
            fontFamily: 'monospace',
            fontSize: 16,
            fill: 0xfff666,
            stroke: 0x333300,
            wordWrap: true,
            wordWrapWidth: 420,
        }
    });
    predictionsText.y = 76;
    hud.addChild(predictionsText);

    const labelText = new PIXI.Text({
        text: 'Label: (R) Restart | (A) Move Left | (D) Move Right | (C) AI Scanning | (P) Capture Frame',
        style: {
            fontFamily: 'monospace',
            fontSize: 16,
            fill: 0xffffff,
            stroke: 0x000000,
        }
    });
    labelText.y = 36;
    labelText.x = 36;
    labelHud.addChild(labelText);

    // Add HUD to stage, ensure it's always on top
    app.stage.sortableChildren = true;
    app.stage.addChild(hud);
    app.stage.addChild(labelHud);

    // Function to reposition HUD at top-right
    function positionHUD() {
        // Margin from the right
        const margin = 16;
        // Find HUD width (in case text wraps/grows)
        const hudWidth = Math.max(scoreText.width, predictionsText.width);
        hud.x = app.renderer.width - hudWidth - margin;
    }

    // Utility for updating HUD
    function updateHUD(data: { score: number, x: number, y: number }) {
        scoreText.text = `Score: ${data.score}`;
        predictionsText.text = `Predictions: (${Math.round(data.x)}, ${Math.round(data.y)})`;
        positionHUD();
    }

    // Position HUD initially and on every resize
    positionHUD();
    window.addEventListener('resize', () => {
        positionHUD();
    });

    return {
        updateHUD,
    };
}
