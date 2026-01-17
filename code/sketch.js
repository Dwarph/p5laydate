// Main p5.js sketch

let flock;
let gradientBuffer;
let currentStage = 1; // 1 = connect, 2 = configure gradient, 3 = spawn boids
let aButtonHoldStart = null;
let aButtonHeld = false;
const A_HOLD_TIME = 1000; // 1 second in milliseconds
let stage3ButtonStates = {}; // Track button states for stage 3

// Track previous values to only update when changed
let lastGradientSize = null;
let lastGradientCenterX = null;
let lastGradientCenterY = null;
let lastGradientUpdateTime = 0;
let isCalculatingGradient = false;
const GRADIENT_UPDATE_THROTTLE = 200; // Only update every 200ms

// Function to set stage (called from playdate.js)
function setStage(stage) {
  currentStage = stage;
  if (stage === 2) {
    // Create initial gradient buffer
    createGradientBuffer();
    // Initialize tracking
    lastGradientSize = window.settings.gradientSize;
    lastGradientCenterX = window.settings.gradientCenterX;
    lastGradientCenterY = window.settings.gradientCenterY;
  }
}

window.setStage = setStage;

function setup() {
  // Use 2D canvas - p5.brush should work in 2D
  createCanvas(1920, 1080);
  
  createP('Drag the mouse to generate new boids.');
  createP('Connect your Playdate and click the button below to start.');

  // Add connect button
  let connectButton = createButton('Connect Playdate');
  connectButton.mousePressed(connectToPlaydate);

  // Don't initialize flock yet - wait for stage 3
  flock = null;

  // Setup GUI controls
  setupGUI();
  
  // Set up Playdate button press callback
  if (window.playdate && window.playdate.setButtonPressCallback) {
    window.playdate.setButtonPressCallback(handleButtonPress);
  }
  
  // Set up Playdate controls update handler for stage 2
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
  // Stage 3: Spawn boids on button press
  if (currentStage === 3) {
    // Check for button presses to spawn boids
    const buttons = ['a', 'b', 'up', 'down', 'left', 'right', 'menu'];
    for (let button of buttons) {
      const isPressed = (state.buttonDown && state.buttonDown[button]) || 
                        (state.pressed && state.pressed[button]) || false;
      const wasPressed = stage3ButtonStates[button] || false;
      
      // Detect new button press
      if (isPressed && !wasPressed && flock) {
        console.log('Button pressed in stage 3:', button);
        createBoidAtCenter();
      }
      
      // Update previous state
      stage3ButtonStates[button] = isPressed;
    }
    
    // Update crank angle directly from state (same as stage 2)
    // Store it in playdate module so boids can access it
    if (state.crank !== undefined && state.crank !== null && !isNaN(state.crank)) {
      if (window.playdate) {
        // Update the crank angle directly
        window.playdate._setCrankAngle(state.crank);
        // If we have a crank angle, it's undocked
        window.playdate._setCrankDocked(false);
      }
    } else {
      // No crank angle - check if explicitly docked
      const docked = state.crankDocked !== undefined ? state.crankDocked : 
                     (state.isCrankDocked !== undefined ? state.isCrankDocked : null);
      if (docked !== null && window.playdate) {
        window.playdate._setCrankDocked(docked);
        if (docked) {
          window.playdate._setCrankAngle(null);
        }
      }
    }
  }
  
  // Stage 2: Configure gradient
  if (currentStage === 2) {
    // Check for A button hold
    const aPressed = (state.buttonDown && state.buttonDown.a) || 
                     (state.pressed && state.pressed.a) || false;
    
    if (aPressed && !aButtonHeld) {
      // Just started holding
      aButtonHeld = true;
      aButtonHoldStart = millis();
    } else if (aPressed && aButtonHeld) {
      // Still holding - check if held long enough
      const holdDuration = millis() - aButtonHoldStart;
      if (holdDuration >= A_HOLD_TIME) {
        // Confirmed! Move to stage 3
        currentStage = 3;
        aButtonHeld = false;
        console.log('Gradient confirmed! Moving to stage 3 - spawning boids');
        // Create gradient buffer with final settings
        createGradientBuffer();
        // Initialize flock
        initializeFlock();
      }
    } else if (!aPressed && aButtonHeld) {
      // Released before confirmation
      aButtonHeld = false;
      aButtonHoldStart = null;
    }
    
    // Throttle gradient updates to prevent crashes
    const now = millis();
    const shouldUpdate = (now - lastGradientUpdateTime) > GRADIENT_UPDATE_THROTTLE;
    
    let needsUpdate = false;
    
    // D-pad controls for gradient center position
    const moveSpeed = 0.01;
    
    // Check both buttonDown and pressed properties for D-pad
    const upPressed = (state.buttonDown && state.buttonDown.up) || 
                      (state.pressed && state.pressed.up) || false;
    const downPressed = (state.buttonDown && state.buttonDown.down) || 
                        (state.pressed && state.pressed.down) || false;
    const leftPressed = (state.buttonDown && state.buttonDown.left) || 
                        (state.pressed && state.pressed.left) || false;
    const rightPressed = (state.buttonDown && state.buttonDown.right) || 
                         (state.pressed && state.pressed.right) || false;
    
    if (upPressed) {
      window.settings.gradientCenterY = max(0, window.settings.gradientCenterY - moveSpeed);
      needsUpdate = true;
    }
    if (downPressed) {
      window.settings.gradientCenterY = min(1, window.settings.gradientCenterY + moveSpeed);
      needsUpdate = true;
    }
    if (leftPressed) {
      window.settings.gradientCenterX = max(0, window.settings.gradientCenterX - moveSpeed);
      needsUpdate = true;
    }
    if (rightPressed) {
      window.settings.gradientCenterX = min(1, window.settings.gradientCenterX + moveSpeed);
      needsUpdate = true;
    }
    
    // Debug: log state structure once to see what's available
    if (!window.debuggedState) {
      console.log('Control state structure:', state);
      console.log('buttonDown:', state.buttonDown);
      console.log('pressed:', state.pressed);
      window.debuggedState = true;
    }
    
    // Crank controls for gradient size
    if (state.crank !== undefined && state.crank !== null && !isNaN(state.crank)) {
      // Map crank angle (0-360) to gradient size (0.2 to 1.5)
      const normalizedAngle = state.crank / 360;
      const newSize = 0.2 + normalizedAngle * 1.3;
      if (Math.abs(newSize - window.settings.gradientSize) > 0.01) {
        window.settings.gradientSize = newSize;
        needsUpdate = true;
      }
    }
    
    // Only update gradient if values changed and enough time has passed
    if (needsUpdate && shouldUpdate && !isCalculatingGradient) {
      // Check if values actually changed
      if (lastGradientSize !== window.settings.gradientSize ||
          lastGradientCenterX !== window.settings.gradientCenterX ||
          lastGradientCenterY !== window.settings.gradientCenterY) {
        // Defer calculation to next frame to prevent blocking
        setTimeout(() => {
          createGradientBuffer();
          lastGradientSize = window.settings.gradientSize;
          lastGradientCenterX = window.settings.gradientCenterX;
          lastGradientCenterY = window.settings.gradientCenterY;
          lastGradientUpdateTime = millis();
          isCalculatingGradient = false;
        }, 0);
        isCalculatingGradient = true;
      }
    }
  }
}

function initializeFlock() {
  flock = new Flock();
  
  // Add an initial set of boids into the system
  for (let i = 0; i < 100; i++) {
    let b = new Boid(width / 2, height / 2);
    flock.addBoid(b);
  }
}

function createGradientBuffer() {
  // Create off-screen graphics buffer for gradient at lower resolution for performance
  // We'll scale it up when drawing
  const bufferWidth = 480; // 1/4 resolution
  const bufferHeight = 270;
  
  // Remove old buffer if it exists
  if (gradientBuffer) {
    try {
      gradientBuffer.remove();
    } catch (e) {
      // Ignore errors if already removed
    }
  }
  
  gradientBuffer = createGraphics(bufferWidth, bufferHeight);
  
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
  gradientBuffer.loadPixels();
  
  for (let y = 0; y < bufferHeight; y++) {
    for (let x = 0; x < bufferWidth; x++) {
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
      const index = (x + y * bufferWidth) * 4;
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
  // Draw gradient background (if created) - scale up from lower resolution
  if (gradientBuffer) {
    image(gradientBuffer, 0, 0, width, height);
  } else {
    background('#fdebb8');
  }
  
  // Show stage instructions
  drawStageInstructions();
  
  // Only run flock in stage 3
  if (currentStage === 3 && flock) {
    flock.run();
  }
}

function drawStageInstructions() {
  fill(0);
  textSize(24);
  textAlign(LEFT, TOP);
  
  if (currentStage === 1) {
    text('Stage 1: Connect your Playdate', 20, 20);
  } else if (currentStage === 2) {
    text('Stage 2: Configure Gradient', 20, 20);
    text('Crank: Size | D-pad: Position | Hold A (1s): Confirm', 20, 50);
    
    // Show A button hold progress
    if (aButtonHeld && aButtonHoldStart) {
      const holdDuration = millis() - aButtonHoldStart;
      const progress = min(holdDuration / A_HOLD_TIME, 1);
      const barWidth = 200;
      const barHeight = 10;
      fill(100);
      rect(20, 90, barWidth, barHeight);
      fill(0);
      rect(20, 90, barWidth * progress, barHeight);
    }
  } else if (currentStage === 3) {
    text('Stage 3: Boids Active', 20, 20);
    text('Press buttons to spawn boids', 20, 50);
  }
}

// On mouse drag, add a new boid to the flock
function mouseDragged() {
  flock.addBoid(new Boid(mouseX, mouseY));
}
