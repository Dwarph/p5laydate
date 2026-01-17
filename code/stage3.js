// Stage 3: Boids active stage

let stage3ButtonStates = {}; // Track button states for stage 3

// Spawn position (normalized 0-1)
let spawnX = 0.5;
let spawnY = 0.5;
const SPAWN_MOVE_SPEED = 0.01; // Movement speed for D-pad

function handleStage3Controls(state) {
  // D-pad controls for spawn position
  const upPressed = (state.buttonDown && state.buttonDown.up) || 
                    (state.pressed && state.pressed.up) || false;
  const downPressed = (state.buttonDown && state.buttonDown.down) || 
                      (state.pressed && state.pressed.down) || false;
  const leftPressed = (state.buttonDown && state.buttonDown.left) || 
                      (state.pressed && state.pressed.left) || false;
  const rightPressed = (state.buttonDown && state.buttonDown.right) || 
                       (state.pressed && state.pressed.right) || false;
  
  // Update spawn position
  if (upPressed) {
    spawnY = max(0, spawnY - SPAWN_MOVE_SPEED);
  }
  if (downPressed) {
    spawnY = min(1, spawnY + SPAWN_MOVE_SPEED);
  }
  if (leftPressed) {
    spawnX = max(0, spawnX - SPAWN_MOVE_SPEED);
  }
  if (rightPressed) {
    spawnX = min(1, spawnX + SPAWN_MOVE_SPEED);
  }
  
  // Check for button presses to spawn boids (excluding D-pad)
  const buttons = ['a', 'b', 'menu'];
  for (let button of buttons) {
    const isPressed = (state.buttonDown && state.buttonDown[button]) || 
                      (state.pressed && state.pressed[button]) || false;
    const wasPressed = stage3ButtonStates[button] || false;
    
    // Detect new button press
    if (isPressed && !wasPressed && window.flock) {
      console.log('Button pressed in stage 3:', button);
      window.createBoidAtPosition(spawnX, spawnY);
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
    // No crank angle in this update
    // Check if explicitly docked (check multiple property names)
    let docked = null;
    if (state.crankDocked !== undefined) {
      docked = state.crankDocked;
    } else if (state.isCrankDocked !== undefined) {
      docked = state.isCrankDocked;
    } else if (state.docked !== undefined) {
      docked = state.docked;
    }
    
    if (docked !== null && window.playdate) {
      // We have explicit dock information
      window.playdate._setCrankDocked(docked);
      if (docked) {
        window.playdate._setCrankAngle(null);
      }
    } else if (window.playdate) {
      // No explicit dock info and no crank value
      // Check if we previously had a crank angle - if we did and now we don't,
      // and it's been a while, infer that it might be docked
      const currentAngle = window.playdate.getCrankAngle();
      const currentDocked = window.playdate.isCrankDocked();
      
      // If we had an angle before but now we're not getting updates,
      // and we're not already marked as docked, check if we should infer docked
      if (currentAngle !== null && !currentDocked) {
        // We had an angle but aren't getting updates now
        // Don't automatically assume docked - might just be slow updates
        // Only set docked if we have explicit info or if angle was cleared
      } else if (currentAngle === null && !currentDocked) {
        // Never had an angle and not explicitly undocked - assume docked
        window.playdate._setCrankDocked(true);
      }
      // Otherwise keep current dock state
    }
  }
}

function drawStage3Instructions() {
  const stageOverlay = document.getElementById('stage-overlay');
  const stageContent = document.getElementById('stage-content');
  const progressOverlay = document.getElementById('progress-overlay');
  
  if (window.currentStage === 3) {
    stageContent.innerHTML = `
      <div>Stage 3: Boids Active</div>
      <div class="instruction">D-pad: Move spawn | Buttons: Spawn boid</div>
    `;
    stageOverlay.style.display = 'block';
    progressOverlay.style.display = 'none';
  }
}

function drawSpawnIndicator() {
  if (window.currentStage !== 3) return;
  
  const spawnScreenX = width * spawnX;
  const spawnScreenY = height * spawnY;
  const indicatorRadius = 8;
  
  push();
  noStroke();
  fill(0, 0, 0, 100); // Transparent black
  circle(spawnScreenX, spawnScreenY, indicatorRadius * 2);
  pop();
}

function drawCrankDebug() {
  if (!window.playdate) return;
  
  const crankAngle = window.playdate.getCrankAngle();
  const crankDocked = window.playdate.isCrankDocked();
  const crankActive = window.playdate.isCrankActive();
  
  // Draw debug panel in bottom-left corner
  const panelY = height - 130;
  push();
  fill(0, 0, 0, 200); // Semi-transparent black background
  noStroke();
  rect(10, panelY, 300, 120, 5);
  
  // Text settings
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  
  // Dock state
  const dockText = crankDocked ? 'DOCKED' : 'UNDOCKED';
  const dockColor = crankDocked ? color(255, 100, 100) : color(100, 255, 100);
  fill(dockColor);
  text(`Crank: ${dockText}`, 20, panelY + 10);
  
  // Rotation state
  fill(255);
  if (crankAngle !== null && !isNaN(crankAngle)) {
    text(`Angle: ${crankAngle.toFixed(1)}°`, 20, panelY + 35);
  } else {
    text(`Angle: N/A`, 20, panelY + 35);
  }
  
  // Active state
  const activeText = crankActive ? 'ACTIVE' : 'INACTIVE';
  const activeColor = crankActive ? color(100, 255, 100) : color(200, 200, 200);
  fill(activeColor);
  text(`Status: ${activeText}`, 20, panelY + 60);
  
  // Visual indicator: draw a circle with a line showing the angle
  if (crankAngle !== null && !isNaN(crankAngle) && !crankDocked) {
    const centerX = 250;
    const centerY = panelY + 60;
    const radius = 30;
    
    // Draw circle
    fill(50, 50, 50, 150);
    stroke(255);
    strokeWeight(2);
    circle(centerX, centerY, radius * 2);
    
    // Draw angle line
    const angleRad = -radians(crankAngle) + PI / 2; // Convert to p5.js coordinate system
    const endX = centerX + cos(angleRad) * radius;
    const endY = centerY + sin(angleRad) * radius;
    
    stroke(crankActive ? color(100, 255, 100) : color(200, 200, 200));
    strokeWeight(3);
    line(centerX, centerY, endX, endY);
    
    // Draw center dot
    fill(255);
    noStroke();
    circle(centerX, centerY, 4);
  }
  
  pop();
}

function initializeStage3() {
  // Reset spawn position to center
  spawnX = 0.5;
  spawnY = 0.5;
  // Reset button states
  stage3ButtonStates = {};
}

// Expose functions to global scope
window.stage3 = {
  handleControls: handleStage3Controls,
  drawInstructions: drawStage3Instructions,
  drawCrankDebug: drawCrankDebug,
  drawSpawnIndicator: drawSpawnIndicator,
  initialize: initializeStage3
};
