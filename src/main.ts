import { Application, Assets, Sprite, Graphics } from "pixi.js";

(async () => {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#000000", resizeTo: window });

  const STAR_COUNT = 150;

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = new Graphics();
    const size = Math.random() * 2 + 0.5; // random size between 0.5 and 2.5

    star.circle(0, 0, size);
    star.fill(0xffffff);

    // Random position across the screen
    star.x = Math.random() * app.screen.width;
    star.y = Math.random() * app.screen.height;

    // Random opacity for depth effect
    star.alpha = Math.random() * 0.8 + 0.2;

    app.stage.addChild(star);
  }

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // Load the assets
  const EnemySpaceInvader = await Assets.load("/assets/invader.png");
  const ShotSpaceInvader = await Assets.load("/assets/shot_invader.png");

  const EnemySpaceInvaderGreen = await Assets.load("/assets/invader_2.png");
  const ShotSpaceInvaderGreen = await Assets.load("/assets/shot_invader_2.png");

  const EnemySpaceInvaderRed = await Assets.load("/assets/invader_3.png");
  const ShotSpaceInvaderRed = await Assets.load("/assets/shot_invader_3.png");

  const EnemyBoss = await Assets.load("/assets/boss.png");
  const ShotEnemyBoss = await Assets.load("/assets/shot_boss.png");

  const Ship = await Assets.load("/assets/ship.png");
  const Bullet = await Assets.load("/assets/shot_ship.png");

  // Create Sprites
  const ship = new Sprite(Ship);
  const bullet = new Sprite(Bullet);

  const shotSpaceInvader = new Sprite(ShotSpaceInvader);
  const enemySpaceInvader = new Sprite(EnemySpaceInvader);
  const enemySpaceInvader2 = new Sprite(EnemySpaceInvader);
  const enemySpaceInvader3 = new Sprite(EnemySpaceInvader);

  const enemiesSpaceInvader = [enemySpaceInvader, enemySpaceInvader2, enemySpaceInvader3];

  const shotSpaceInvaderGreen = new Sprite(ShotSpaceInvaderGreen);
  const enemySpaceInvaderGreen = new Sprite(EnemySpaceInvaderGreen);
  const enemySpaceInvaderGreen2 = new Sprite(EnemySpaceInvaderGreen);
  const enemySpaceInvaderGreen3 = new Sprite(EnemySpaceInvaderGreen);
  const enemySpaceInvaderGreen4 = new Sprite(EnemySpaceInvaderGreen);
  const enemySpaceInvaderGreen5 = new Sprite(EnemySpaceInvaderGreen);
  const enemiesSpaceInvaderGreen = [
    enemySpaceInvaderGreen,
    enemySpaceInvaderGreen2,
    enemySpaceInvaderGreen3,
    enemySpaceInvaderGreen4,
    enemySpaceInvaderGreen5,
  ];

  const shotSpaceInvaderRed = new Sprite(ShotSpaceInvaderRed);
  const enemySpaceInvaderRed = new Sprite(EnemySpaceInvaderRed);
  const enemySpaceInvaderRed2 = new Sprite(EnemySpaceInvaderRed);
  const enemySpaceInvaderRed3 = new Sprite(EnemySpaceInvaderRed);
  const enemySpaceInvaderRed4 = new Sprite(EnemySpaceInvaderRed);
  const enemySpaceInvaderRed5 = new Sprite(EnemySpaceInvaderRed);
  const enemySpaceInvaderRed6 = new Sprite(EnemySpaceInvaderRed);
  const enemySpaceInvaderRed7 = new Sprite(EnemySpaceInvaderRed);
  const enemiesSpaceInvaderRed = [
    enemySpaceInvaderRed,
    enemySpaceInvaderRed2,
    enemySpaceInvaderRed3,
    enemySpaceInvaderRed4,
    enemySpaceInvaderRed5,
    enemySpaceInvaderRed6,
    enemySpaceInvaderRed7,
  ];

  const BOTTOM_PADDING = 20;
  const TOP_PADDING = 20;

  // Center the sprite's anchor point
  ship.anchor.set(0.5);
  ship.width = 150;
  ship.height = 100;

  bullet.anchor.set(0.5);
  bullet.width = 60;
  bullet.height = 100;

  for (let i = 0; i < enemiesSpaceInvader.length; i++) {
    const enemy = enemiesSpaceInvader[i];
    enemy.anchor.set(0.5);
    enemy.width = 150;
    enemy.height = 100;

    enemy.position.set((app.screen.width / 2.5) + (i * 400), app.screen.height / 5 - TOP_PADDING);
    app.stage.addChild(enemy);
  }
  for (let i = 0; i < enemiesSpaceInvaderGreen.length; i++) {
    const enemy = enemiesSpaceInvaderGreen[i];
    enemy.anchor.set(0.5);
    enemy.width = 150;
    enemy.height = 100;

    enemy.position.set((app.screen.width / 3.5) + (i * 350), app.screen.height / 3 - TOP_PADDING);
    app.stage.addChild(enemy);
  }

  for (let i = 0; i < enemiesSpaceInvaderRed.length; i++) {
    const enemy = enemiesSpaceInvaderRed[i];
    enemy.anchor.set(0.5);
    enemy.width = 150;
    enemy.height = 100;

    enemy.position.set((app.screen.width / 4.5) + (i * 300), app.screen.height / 2 - TOP_PADDING);
    app.stage.addChild(enemy);
  }

  // Move the sprite to the center of the screen
  ship.position.set(app.screen.width / 2, app.screen.height - ship.height / 2 - BOTTOM_PADDING);

  // Add the bunny to the stage
  app.stage.addChild(ship);
  
  const keys: Record<string, boolean> = {};

  window.addEventListener("keydown", (e) => (keys[e.key] = true));
  window.addEventListener("keyup", (e) => (keys[e.key] = false));

  let bulletActive = false;

  const SPEED = 20;
  const BULLET_SPEED = 15;

  // Listen for animate update
  app.ticker.add((time) => {
    if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
      let currentShipPosition = ship.x;

      if ((currentShipPosition -= SPEED) <= 100) {
        return false;
      }
        ship.x -= SPEED;
    }

    if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
      let currentShipPosition = ship.x;

      if ((currentShipPosition += SPEED) >= app.canvas.width - 100) {
        return false;
      }

      ship.x += SPEED;
    }

    if (keys[" "] && !bulletActive) {
      bullet.position.set(ship.x, ship.y - 80);
      app.stage.addChild(bullet);
      bulletActive = true;
    }

    if (keys["r"] || keys["R"]) {
      window.location.reload();
    }

    // if (keys["ArrowUp"] || keys["w"] || keys["W"]) ship.y -= SPEED;
    // if (keys["ArrowDown"] || keys["s"] || keys["S"]) ship.y += SPEED;

    if (bulletActive) {
      bullet.y -= BULLET_SPEED;
  
      // Remove bullet if it reaches the top
      if (bullet.y < 0) {
        app.stage.removeChild(bullet);
        bulletActive = false;
      }
  
      // Check collision with each enemy
      const enemies = [
        ...enemiesSpaceInvader,
        ...enemiesSpaceInvaderGreen,
        ...enemiesSpaceInvaderRed,
      ];
  
      for (const enemy of enemies) {
        if (enemy.parent && bullet.parent) {
          const enemyBounds = enemy.getBounds();
          const bulletBounds = bullet.getBounds();
  
          if (enemy.visible) {
            if (bulletBounds.maxX > enemyBounds.minX && bulletBounds.minX < enemyBounds.maxX && bulletBounds.maxY > enemyBounds.minY && bulletBounds.minY < enemyBounds.maxY) {
              // Remove bullet and enemy on collision
              app.stage.removeChild(bullet);
              app.stage.removeChild(enemy);
              bulletActive = false;
            }
          }
        }
      }
    }

    // Just for fun, let's rotate mr rabbit a little.
    // * Delta is 1 if running at 100% performance *
    // * Creates frame-independent transformation *
    // ship.rotation += 0.1 * time.deltaTime;
  });
})();
