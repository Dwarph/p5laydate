// Main p5.js sketch - coordinates between stages

// Global state
let flock;
let gradientBuffer;
let currentStage = 1; // 1 = connect, 2 = configure gradient, 3 = spawn boids

// Expose to window for stage modules
window.flock = flock;
window.gradientBuffer = gradientBuffer;
window.currentStage = currentStage;

// Function to set stage (called from playdate.js)
function setStage(stage) {
  console.log('setStage called with stage:', stage);
  currentStage = stage;
  window.currentStage = stage;
  
  if (stage === 2) {
    // Initialize stage 2
    if (window.stage2 && window.stage2.initialize) {
      window.stage2.initialize();
    }
  } else if (stage === 3) {
    console.log('Stage 3 initialized, flock:', !!flock);
  }
  
  // Update UI visibility
  if (window.stage1 && window.stage1.updateConnectionUI) {
    window.stage1.updateConnectionUI();
  }
}

window.setStage = setStage;

function setup() {
  // Use 2D canvas - p5.brush should work in 2D
  createCanvas(1920, 1080);
  
  // Set up connect button (HTML element created in index.html)
  const connectButton = document.getElementById('connect-button');
  if (connectButton) {
    connectButton.addEventListener('click', connectToPlaydate);
  }
  
  // Show connection UI initially
  if (window.stage1 && window.stage1.updateConnectionUI) {
    window.stage1.updateConnectionUI();
  }

  // Don't initialize flock yet - wait for stage 3
  flock = null;
  window.flock = null;

  // Setup GUI controls
  setupGUI();
  
  // Set up Playdate button press callback
  if (window.playdate && window.playdate.setButtonPressCallback) {
    window.playdate.setButtonPressCallback(handleButtonPress);
  }
  
  // Set up Playdate controls update handler
  if (window.playdate && window.playdate.setControlsUpdateCallback) {
    window.playdate.setControlsUpdateCallback(handleControlsUpdate);
  }

  describe(
    'A group of bird-like objects, represented by brush strokes, moving across the canvas, modeling flocking behavior.'
  );
}

function handleButtonPress() {
  // Only spawn boids in stage 3
  console.log('Button pressed, current stage:', currentStage);
  if (currentStage === 3 && flock) {
    console.log('Spawning boid at center');
    createBoidAtCenter();
  } else {
    console.log('Not spawning - stage:', currentStage, 'flock exists:', !!flock);
  }
}

// Expose to global scope so playdate.js can access it after connection
window.handleButtonPress = handleButtonPress;
window.handleControlsUpdate = handleControlsUpdate;

function handleControlsUpdate(state) {
  // Route to appropriate stage handler
  if (currentStage === 2 && window.stage2 && window.stage2.handleControls) {
    window.stage2.handleControls(state);
  } else if (currentStage === 3 && window.stage3 && window.stage3.handleControls) {
    window.stage3.handleControls(state);
  } else {
    // Debug: log if no handler is found
    if (currentStage === 3) {
      console.log('Stage 3 but no handler - stage3 exists:', !!window.stage3, 'handleControls exists:', !!(window.stage3 && window.stage3.handleControls));
    }
  }
}

function initializeFlock() {
  flock = new Flock();
  window.flock = flock;
  
  // Add an initial set of boids into the system
  for (let i = 0; i < 100; i++) {
    let b = new Boid(width / 2, height / 2);
    flock.addBoid(b);
  }
}

window.initializeFlock = initializeFlock;

function createGradientBuffer() {
  // Create off-screen graphics buffer for gradient at lower resolution for performance
  // We'll scale it up when drawing
  // Increased resolution slightly for better quality while maintaining performance
  const bufferWidth = 640; // ~1/3 resolution (was 480)
  const bufferHeight = 360; // ~1/3 resolution (was 270)
  
  // Remove old buffer if it exists
  if (gradientBuffer) {
    try {
      gradientBuffer.remove();
    } catch (e) {
      // Ignore errors if already removed
    }
  }
  
  gradientBuffer = createGraphics(bufferWidth, bufferHeight);
  window.gradientBuffer = gradientBuffer;
  
  // Center colors
  const centerR = 253; // #fdebb8
  const centerG = 235;
  const centerB = 184;
  
  // Outer colors
  const outerR = 190; // #bee9fc
  const outerG = 233;
  const outerB = 252;
  
  // Center of canvas (from settings) - scaled to buffer size
  const centerX = bufferWidth * window.settings.gradientCenterX;
  const centerY = bufferHeight * window.settings.gradientCenterY;
  const baseRadius = dist(0, 0, bufferWidth / 2, bufferHeight / 2);
  const maxRadius = baseRadius * window.settings.gradientSize;
  
  // Draw gradient with noise at lower resolution
  // Optimized: pre-calculate values outside loops where possible
  gradientBuffer.loadPixels();
  
  const pixels = gradientBuffer.pixels;
  const noiseScale = 0.1;
  const noiseStrength = 0.3;
  
  // Pre-calculate squared maxRadius to avoid sqrt in dist() call
  const maxRadiusSq = maxRadius * maxRadius;
  
  for (let y = 0; y < bufferHeight; y++) {
    const yOffset = y * bufferWidth;
    const dy = y - centerY;
    const dySq = dy * dy;
    
    for (let x = 0; x < bufferWidth; x++) {
      // Calculate distance squared (faster than dist())
      const dx = x - centerX;
      const dSq = dx * dx + dySq;
      const d = sqrt(dSq);
      const normalizedDist = d / maxRadius;
      
      // Add noise for variation (static, no frameCount)
      const noiseVal = noise(x * noiseScale, y * noiseScale);
      const noiseOffset = (noiseVal - 0.5) * noiseStrength;
      
      // Apply noise to the distance
      const noisyDist = constrain(normalizedDist + noiseOffset, 0, 1);
      
      // Interpolate colors
      const r = lerp(centerR, outerR, noisyDist);
      const g = lerp(centerG, outerG, noisyDist);
      const b = lerp(centerB, outerB, noisyDist);
      
      // Set pixel (direct array access is faster)
      const index = (x + yOffset) * 4;
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = 255;
    }
  }
  
  gradientBuffer.updatePixels();
}

window.createGradientBuffer = createGradientBuffer;

function createBoidAtCenter() {
  if (flock) {
    flock.addBoid(new Boid(width / 2, height / 2));
  }
}

window.createBoidAtCenter = createBoidAtCenter;

function draw() {
  // Draw gradient background (if created) - scale up from lower resolution
  if (gradientBuffer) {
    image(gradientBuffer, 0, 0, width, height);
  } else {
    background('#fdebb8');
  }
  
  // Show stage instructions
  drawStageInstructions();
  
  // Only run flock in stage 3
  if (currentStage === 3) {
    if (flock) {
      flock.run();
      // Draw crank debug info
      if (window.stage3 && window.stage3.drawCrankDebug) {
        window.stage3.drawCrankDebug();
      }
    } else {
      // Debug: log if stage 3 but no flock
      if (frameCount % 60 === 0) { // Log once per second
        console.log('Stage 3 active but no flock - flock:', !!flock);
      }
    }
  }
}

function drawStageInstructions() {
  // Route to appropriate stage's instruction drawer
  if (currentStage === 1 && window.stage1 && window.stage1.drawInstructions) {
    window.stage1.drawInstructions();
  } else if (currentStage === 2 && window.stage2 && window.stage2.drawInstructions) {
    window.stage2.drawInstructions();
  } else if (currentStage === 3 && window.stage3 && window.stage3.drawInstructions) {
    window.stage3.drawInstructions();
  } else {
    // Fallback: hide overlays
    const stageOverlay = document.getElementById('stage-overlay');
    const progressOverlay = document.getElementById('progress-overlay');
    if (stageOverlay) stageOverlay.style.display = 'none';
    if (progressOverlay) progressOverlay.style.display = 'none';
  }
}

// On mouse drag, add a new boid to the flock
function mouseDragged() {
  if (flock) {
    flock.addBoid(new Boid(mouseX, mouseY));
  }
}
