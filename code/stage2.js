// Stage 2: Gradient placement stage

// Gradient color definitions (blue, yellow, off-white)
// Using original gradient colors: center #fdebb8 (253, 235, 184), outer #bee9fc (190, 233, 252)
const GRADIENT_COLORS = [
  { center: { r: 253, g: 235, b: 184 }, outer: { r: 190, g: 233, b: 252 } }, // Blue (original)
  { center: { r: 253, g: 235, b: 184 }, outer: { r: 255, g: 220, b: 100 } }, // Yellow
  { center: { r: 255, g: 253, b: 242 }, outer: { r: 240, g: 230, b: 200 } }  // Off-white (#fffdf2)
];

// Expose to global scope for use in sketch.js
window.GRADIENT_COLORS = GRADIENT_COLORS;

// Array to store placed gradients
let placedGradients = [];

// Current gradient being configured (before placement)
let currentGradientIndex = 0; // 0 = blue, 1 = yellow, 2 = off-white
let currentGradientSize = 1.0;
let currentGradientCenterX = 0.5;
let currentGradientCenterY = 0.5;

// Button state tracking
let aButtonPressed = false; // A button for placing gradients
let bButtonPressed = false; // B button for finishing
let bButtonHoldStart = null;
const B_HOLD_TIME = 1000; // 1 second to confirm and move to stage 3

// Track previous crank angle for relative input (stage 2 specific)
let stage2PreviousCrankAngle = null;

function handleStage2Controls(state) {
  // Early return if we're no longer in stage 2 (safety check)
  if (window.currentStage !== 2) {
    return;
  }
  
  // Check for A button (mapped to B button on Playdate) - places gradients
  const aPressed = (state.buttonDown && state.buttonDown.b) || 
                   (state.pressed && state.pressed.b) || false;
  
  // Check for B button (mapped to A button on Playdate) - finishes/confirms
  const bPressed = (state.buttonDown && state.buttonDown.a) || 
                   (state.pressed && state.pressed.a) || false;
  
  const now = millis();
  
  // Handle A button press/release - only place gradient
  if (aPressed && !aButtonPressed) {
    // Just pressed - place gradient immediately
    placeGradient();
    aButtonPressed = true;
  } else if (!aPressed && aButtonPressed) {
    // Released
    aButtonPressed = false;
  }
  
  // Handle B button press/release - hold to finish
  if (bPressed && !bButtonPressed) {
    // Just pressed - start hold timer
    bButtonPressed = true;
    bButtonHoldStart = now;
  } else if (bPressed && bButtonPressed) {
    // Still holding - check if held long enough to confirm and move to stage 3
    const holdDuration = now - bButtonHoldStart;
    
    if (holdDuration >= B_HOLD_TIME) {
      // Confirmed! Save final background and move to stage 3
      bButtonPressed = false;
      bButtonHoldStart = null;
      console.log('Background confirmed! Moving to stage 3 - spawning boids');
      // Create final gradient buffer with all placed gradients
      window.createGradientBuffer();
      // Initialize flock
      window.initializeFlock();
      // Use setStage to properly transition
      if (window.setStage) {
        window.setStage(3);
        console.log('Stage transitioned to 3, currentStage:', window.currentStage);
      }
    }
  } else if (!bPressed && bButtonPressed) {
    // Released before holding long enough
    bButtonPressed = false;
    bButtonHoldStart = null;
  }
  
  // D-pad controls for current gradient center position
  const moveSpeed = 0.01;
  
  const upPressed = (state.buttonDown && state.buttonDown.up) || 
                    (state.pressed && state.pressed.up) || false;
  const downPressed = (state.buttonDown && state.buttonDown.down) || 
                      (state.pressed && state.pressed.down) || false;
  const leftPressed = (state.buttonDown && state.buttonDown.left) || 
                      (state.pressed && state.pressed.left) || false;
  const rightPressed = (state.buttonDown && state.buttonDown.right) || 
                       (state.pressed && state.pressed.right) || false;
  
  let positionChanged = false;
  
  if (upPressed) {
    const newY = max(0, currentGradientCenterY - moveSpeed);
    if (newY !== currentGradientCenterY) {
      currentGradientCenterY = newY;
      positionChanged = true;
    }
  }
  if (downPressed) {
    const newY = min(1, currentGradientCenterY + moveSpeed);
    if (newY !== currentGradientCenterY) {
      currentGradientCenterY = newY;
      positionChanged = true;
    }
  }
  if (leftPressed) {
    const newX = max(0, currentGradientCenterX - moveSpeed);
    if (newX !== currentGradientCenterX) {
      currentGradientCenterX = newX;
      positionChanged = true;
    }
  }
  if (rightPressed) {
    const newX = min(1, currentGradientCenterX + moveSpeed);
    if (newX !== currentGradientCenterX) {
      currentGradientCenterX = newX;
      positionChanged = true;
    }
  }
  
  // Crank controls for current gradient size - relative input
  if (state.crank !== undefined && state.crank !== null && !isNaN(state.crank)) {
    const currentCrankAngle = state.crank;
    
    if (stage2PreviousCrankAngle !== null) {
      // Calculate relative change in crank angle
      let deltaAngle = currentCrankAngle - stage2PreviousCrankAngle;
      
      // Handle wraparound
      if (deltaAngle > 180) {
        deltaAngle -= 360;
      } else if (deltaAngle < -180) {
        deltaAngle += 360;
      }
      
      // Only apply change if there's actual movement
      if (Math.abs(deltaAngle) > 0.1) {
        // Convert angle change to size change
        const sizeChange = deltaAngle / 360;
        
        // Apply relative change to current size
        const newSize = constrain(
          currentGradientSize + sizeChange,
          0.2,  // min size
          1.5   // max size
        );
        
        if (Math.abs(newSize - currentGradientSize) > 0.001) {
          currentGradientSize = newSize;
          // Preview updates automatically in draw() loop
        }
      }
    } else {
      // First time detecting crank - initialize tracking
      console.log('Crank detected for first time, angle:', currentCrankAngle);
    }
    
    // Update previous angle for next frame
    stage2PreviousCrankAngle = currentCrankAngle;
  } else {
    // No crank input - reset tracking
    stage2PreviousCrankAngle = null;
  }
  
  // Preview updates automatically in draw() loop, no need to call updateGradientPreview
}

// Function to place a gradient at current position
function placeGradient() {
  const gradient = {
    centerX: currentGradientCenterX,
    centerY: currentGradientCenterY,
    size: currentGradientSize,
    colorIndex: currentGradientIndex
  };
  
  placedGradients.push(gradient);
  console.log(`Placed gradient ${placedGradients.length}: color ${currentGradientIndex}, size ${currentGradientSize.toFixed(2)}, pos (${currentGradientCenterX.toFixed(2)}, ${currentGradientCenterY.toFixed(2)})`);
  
  // Cycle to next color
  currentGradientIndex = (currentGradientIndex + 1) % GRADIENT_COLORS.length;
  
  // Update preview incrementally (just add the new gradient)
  window.updateGradientPreview(false);
}

function drawStage2Instructions() {
  const stageOverlay = document.getElementById('stage-overlay');
  const stageContent = document.getElementById('stage-content');
  const progressOverlay = document.getElementById('progress-overlay');
  const progressFill = document.querySelector('.progress-fill');
  
  if (window.currentStage === 2) {
    const colorNames = ['Blue', 'Yellow', 'Off-white'];
    const currentColorName = colorNames[currentGradientIndex];
    
    stageContent.innerHTML = `
      <div>Stage 2: Place Gradients</div>
      <div class="instruction">Current: ${currentColorName} | Placed: ${placedGradients.length}</div>
      <div class="instruction">Crank: Size | D-pad: Position | Press A: Place | Hold B (1s): Finish</div>
    `;
    stageOverlay.style.display = 'block';
    
    // Update progress bar for B button confirmation hold
    if (bButtonPressed && bButtonHoldStart) {
      const holdProgress = (millis() - bButtonHoldStart) / B_HOLD_TIME;
      progressFill.style.width = (holdProgress * 100) + '%';
      progressOverlay.style.display = 'block';
    } else {
      progressOverlay.style.display = 'none';
      progressFill.style.width = '0%';
    }
  }
}

function initializeStage2() {
  // Reset state
  placedGradients = [];
  currentGradientIndex = 0;
  currentGradientSize = 1.0;
  currentGradientCenterX = 0.5;
  currentGradientCenterY = 0.5;
  aButtonPressed = false;
  bButtonPressed = false;
  bButtonHoldStart = null;
  stage2PreviousCrankAngle = null;
  
  // Reset gradient count tracking
  if (window.resetGradientCount) {
    window.resetGradientCount();
  }
  
  // Reset preview cache
  if (window.previewBuffer) {
    try {
      window.previewBuffer.remove();
    } catch (e) {
      // Ignore errors
    }
    window.previewBuffer = null;
  }
  if (window.resetPreviewCache) {
    window.resetPreviewCache();
  }
  
  // Create initial preview (force full render)
  window.updateGradientPreview(true);
}

// Expose placed gradients array to global scope
window.getPlacedGradients = () => placedGradients;

// Expose functions to global scope
window.stage2 = {
  handleControls: handleStage2Controls,
  drawInstructions: drawStage2Instructions,
  initialize: initializeStage2,
  // Expose current gradient properties for preview
  get currentGradientIndex() { return currentGradientIndex; },
  get currentGradientSize() { return currentGradientSize; },
  get currentGradientCenterX() { return currentGradientCenterX; },
  get currentGradientCenterY() { return currentGradientCenterY; }
};
