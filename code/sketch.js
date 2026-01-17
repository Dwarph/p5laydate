// Main p5.js sketch

let flock;
let gradientBuffer;

function setup() {
  // Use 2D canvas - p5.brush should work in 2D
  createCanvas(1920, 1080);
  
  createP('Drag the mouse to generate new boids.');
  createP('Connect your Playdate and click the button below to start.');

  // Add connect button
  let connectButton = createButton('Connect Playdate');
  connectButton.mousePressed(connectToPlaydate);

  flock = new Flock();

  // Add an initial set of boids into the system
  for (let i = 0; i < 100; i++) {
    let b = new Boid(width / 2, height / 2);
    flock.addBoid(b);
  }

  // Setup GUI controls
  setupGUI();
  
  // Set up Playdate button press callback
  if (window.playdate && window.playdate.setButtonPressCallback) {
    window.playdate.setButtonPressCallback(createBoidAtCenter);
  }
  
  // Create gradient buffer once
  createGradientBuffer();

  describe(
    'A group of bird-like objects, represented by brush strokes, moving across the canvas, modeling flocking behavior.'
  );
}

function createGradientBuffer() {
  // Create off-screen graphics buffer for gradient
  gradientBuffer = createGraphics(width, height);
  
  // Center colors
  const centerR = 253; // #fdebb8
  const centerG = 235;
  const centerB = 184;
  
  // Outer colors
  const outerR = 190; // #bee9fc
  const outerG = 233;
  const outerB = 252;
  
  // Center of canvas
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = dist(0, 0, centerX, centerY); // Distance to corner
  
  // Draw gradient with noise (calculated once)
  gradientBuffer.loadPixels();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate distance from center
      const d = dist(x, y, centerX, centerY);
      const normalizedDist = d / maxRadius;
      
      // Add noise for variation (static, no frameCount)
      const noiseScale = 0.1;
      const noiseVal = noise(x * noiseScale, y * noiseScale);
      const noiseOffset = (noiseVal - 0.5) * 0.3; // Strong noise variation
      
      // Apply noise to the distance
      const noisyDist = constrain(normalizedDist + noiseOffset, 0, 1);
      
      // Interpolate colors
      const r = lerp(centerR, outerR, noisyDist);
      const g = lerp(centerG, outerG, noisyDist);
      const b = lerp(centerB, outerB, noisyDist);
      
      // Set pixel
      const index = (x + y * width) * 4;
      gradientBuffer.pixels[index] = r;
      gradientBuffer.pixels[index + 1] = g;
      gradientBuffer.pixels[index + 2] = b;
      gradientBuffer.pixels[index + 3] = 255;
    }
  }
  
  gradientBuffer.updatePixels();
}

function createBoidAtCenter() {
  if (flock) {
    flock.addBoid(new Boid(width / 2, height / 2));
  }
}

function draw() {
  // Draw pre-calculated gradient background
  image(gradientBuffer, 0, 0);
  flock.run();
}

// On mouse drag, add a new boid to the flock
function mouseDragged() {
  flock.addBoid(new Boid(mouseX, mouseY));
}
