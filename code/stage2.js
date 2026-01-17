// Stage 2: Gradient configuration stage

let aButtonHoldStart = null;
let aButtonHeld = false;
const A_HOLD_TIME = 1000; // 1 second in milliseconds

// Track previous values to only update when changed
let lastGradientSize = null;
let lastGradientCenterX = null;
let lastGradientCenterY = null;
let lastGradientUpdateTime = 0;
let isCalculatingGradient = false;
const GRADIENT_UPDATE_THROTTLE = 200; // Only update every 200ms

function handleStage2Controls(state) {
  // Early return if we're no longer in stage 2 (safety check)
  if (window.currentStage !== 2) {
    return;
  }
  
  // Check for A button hold
  // Note: state.buttonDown.a appears to be mapped to the B button on the Playdate
  const aPressed = (state.buttonDown && state.buttonDown.b) || 
                   (state.pressed && state.pressed.b) || false;
  
  if (aPressed && !aButtonHeld) {
    // Just started holding
    console.log('A button hold started');
    aButtonHeld = true;
    aButtonHoldStart = millis();
  } else if (aPressed && aButtonHeld) {
    // Still holding - check if held long enough
    const holdDuration = millis() - aButtonHoldStart;
    if (holdDuration >= A_HOLD_TIME) {
      // Confirmed! Move to stage 3
      aButtonHeld = false;
      console.log('Gradient confirmed! Moving to stage 3 - spawning boids');
      // Create gradient buffer with final settings
      window.createGradientBuffer();
      // Initialize flock
      window.initializeFlock();
      // Use setStage to properly transition
      if (window.setStage) {
        window.setStage(3);
        console.log('Stage transitioned to 3, currentStage:', window.currentStage);
      }
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
        window.createGradientBuffer();
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

function drawStage2Instructions() {
  const stageOverlay = document.getElementById('stage-overlay');
  const stageContent = document.getElementById('stage-content');
  const progressOverlay = document.getElementById('progress-overlay');
  const progressFill = document.querySelector('.progress-fill');
  
  if (window.currentStage === 2) {
    stageContent.innerHTML = `
      <div>Stage 2: Configure Gradient</div>
      <div class="instruction">Crank: Size | D-pad: Position | Hold A (1s): Confirm</div>
    `;
    stageOverlay.style.display = 'block';
    
    // Update progress bar
    if (aButtonHeld && aButtonHoldStart) {
      const holdProgress = (millis() - aButtonHoldStart) / A_HOLD_TIME;
      progressFill.style.width = (holdProgress * 100) + '%';
      progressOverlay.style.display = 'block';
    } else {
      progressOverlay.style.display = 'none';
      progressFill.style.width = '0%';
    }
  }
}

function initializeStage2() {
  // Create initial gradient buffer
  window.createGradientBuffer();
  // Initialize tracking
  lastGradientSize = window.settings.gradientSize;
  lastGradientCenterX = window.settings.gradientCenterX;
  lastGradientCenterY = window.settings.gradientCenterY;
}

// Expose functions to global scope
window.stage2 = {
  handleControls: handleStage2Controls,
  drawInstructions: drawStage2Instructions,
  initialize: initializeStage2
};
