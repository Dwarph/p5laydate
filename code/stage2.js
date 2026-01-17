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
let gradientUpdateRequested = false;
const GRADIENT_UPDATE_THROTTLE = 16; // ~60fps updates (16ms per frame)

// Track previous crank angle for relative input (stage 2 specific)
let stage2PreviousCrankAngle = null;

function handleStage2Controls(state) {
  // Early return if we're no longer in stage 2 (safety check)
  if (window.currentStage !== 2) {
    return;
  }
  
  // Debug: log that we're in stage 2 (once)
  if (!window._stage2DebugLogged) {
    console.log('Stage 2 controls handler active');
    window._stage2DebugLogged = true;
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
  // Allow immediate update if this is the first update (lastGradientUpdateTime === 0)
  const now = millis();
  const shouldUpdate = lastGradientUpdateTime === 0 || (now - lastGradientUpdateTime) > GRADIENT_UPDATE_THROTTLE;
  
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
    const newY = max(0, window.settings.gradientCenterY - moveSpeed);
    if (newY !== window.settings.gradientCenterY) {
      window.settings.gradientCenterY = newY;
      needsUpdate = true;
    }
  }
  if (downPressed) {
    const newY = min(1, window.settings.gradientCenterY + moveSpeed);
    if (newY !== window.settings.gradientCenterY) {
      window.settings.gradientCenterY = newY;
      needsUpdate = true;
    }
  }
  if (leftPressed) {
    const newX = max(0, window.settings.gradientCenterX - moveSpeed);
    if (newX !== window.settings.gradientCenterX) {
      window.settings.gradientCenterX = newX;
      needsUpdate = true;
    }
  }
  if (rightPressed) {
    const newX = min(1, window.settings.gradientCenterX + moveSpeed);
    if (newX !== window.settings.gradientCenterX) {
      window.settings.gradientCenterX = newX;
      needsUpdate = true;
    }
  }
  
  // Debug: log state structure once to see what's available
  if (!window.debuggedState) {
    console.log('Control state structure:', state);
    console.log('buttonDown:', state.buttonDown);
    console.log('pressed:', state.pressed);
    window.debuggedState = true;
  }
  
  // Crank controls for gradient size - relative input
  if (state.crank !== undefined && state.crank !== null && !isNaN(state.crank)) {
    const currentCrankAngle = state.crank;
    
    if (stage2PreviousCrankAngle !== null) {
      // Calculate relative change in crank angle
      let deltaAngle = currentCrankAngle - stage2PreviousCrankAngle;
      
      // Handle wraparound (e.g., going from 350° to 10° should be +20°, not -340°)
      if (deltaAngle > 180) {
        deltaAngle -= 360;
      } else if (deltaAngle < -180) {
        deltaAngle += 360;
      }
      
      // Only apply change if there's actual movement (ignore tiny jitter)
      if (Math.abs(deltaAngle) > 0.1) {
        // Convert angle change to size change
        // Scale: full rotation (360°) = change of 1.0 in size
        // So 1° = 1/360 ≈ 0.0028 change
        const sizeChange = deltaAngle / 360;
        
        // Apply relative change to current size
        const newSize = constrain(
          window.settings.gradientSize + sizeChange,
          0.2,  // min size
          1.5   // max size
        );
        
        if (Math.abs(newSize - window.settings.gradientSize) > 0.001) {
          window.settings.gradientSize = newSize;
          needsUpdate = true;
        }
      }
    } else {
      // First time detecting crank - initialize tracking but don't change size
      console.log('Crank detected for first time, angle:', currentCrankAngle);
    }
    
    // Update previous angle for next frame
    stage2PreviousCrankAngle = currentCrankAngle;
  } else {
    // No crank input - reset tracking
    stage2PreviousCrankAngle = null;
  }
  
  // Only update gradient if values changed and enough time has passed
  if (needsUpdate && shouldUpdate && !isCalculatingGradient) {
    // Check if values actually changed
    if (lastGradientSize !== window.settings.gradientSize ||
        lastGradientCenterX !== window.settings.gradientCenterX ||
        lastGradientCenterY !== window.settings.gradientCenterY) {
      // Request update via requestAnimationFrame for smoother performance
      if (!gradientUpdateRequested) {
        gradientUpdateRequested = true;
        const updateTime = millis();
        requestAnimationFrame(() => {
          window.createGradientBuffer();
          lastGradientSize = window.settings.gradientSize;
          lastGradientCenterX = window.settings.gradientCenterX;
          lastGradientCenterY = window.settings.gradientCenterY;
          lastGradientUpdateTime = updateTime;
          isCalculatingGradient = false;
          gradientUpdateRequested = false;
        });
        isCalculatingGradient = true;
      }
    }
  } else if (needsUpdate) {
    // Debug: log why update didn't happen
    if (frameCount % 60 === 0) { // Log once per second
      console.log('Stage 2 update blocked:', {
        needsUpdate,
        shouldUpdate,
        isCalculatingGradient,
        timeSinceLastUpdate: millis() - lastGradientUpdateTime
      });
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
  // Reset crank tracking
  stage2PreviousCrankAngle = null;
}

// Expose functions to global scope
window.stage2 = {
  handleControls: handleStage2Controls,
  drawInstructions: drawStage2Instructions,
  initialize: initializeStage2
};
