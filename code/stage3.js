// Stage 3: Boids active stage

let stage3ButtonStates = {}; // Track button states for stage 3

// Spawn position (normalized 0-1)
let spawnX = 0.5;
let spawnY = 0.5;
const SPAWN_MOVE_SPEED = 0.01; // Movement speed for D-pad

// B button state for attracting/pushing boids
let bButtonHeld = false;
let bButtonWasHeld = false;
let bButtonReleasedThisStage = false; // Track if B has been released since entering stage 3
const ATTRACT_FORCE_STRENGTH = 0.15; // Force strength when attracting
const PUSH_FORCE_STRENGTH = 2.0; // Force strength when pushing away

// A button state for continuous spawning
let lastSpawnTime = 0;
const SPAWN_INTERVAL = 100; // Milliseconds between spawns when A is held

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
  
  // Check for A button - continuously spawn boids while held (A is mapped to B button on Playdate)
  const aPressed = (state.buttonDown && state.buttonDown.b) || 
                   (state.pressed && state.pressed.b) || false;
  
  // Continuously spawn boids while A is held
  if (aPressed && window.flock) {
    const now = millis();
    if (now - lastSpawnTime >= SPAWN_INTERVAL) {
      window.createBoidAtPosition(spawnX, spawnY);
      lastSpawnTime = now;
    }
  }
  
  // Update previous state
  stage3ButtonStates['a'] = aPressed;
  
  // Check for B button (mapped to 'a' button on Playdate) for attract/push
  const bPressed = (state.buttonDown && state.buttonDown.a) || 
                   (state.pressed && state.pressed.a) || false;
  bButtonWasHeld = bButtonHeld;
  
  // If B is not pressed, mark that we've seen a release (allows subsequent presses to work)
  if (!bPressed) {
    bButtonReleasedThisStage = true;
    bButtonHeld = false;
  } else if (bPressed && !bButtonWasHeld) {
    // Button was just pressed - only activate if we've seen a release
    if (bButtonReleasedThisStage) {
      bButtonHeld = true;
      console.log('B button pressed - attracting boids');
    } else {
      // Ignore this press - was held when entering stage 3
      bButtonHeld = false;
    }
  } else if (bPressed && bButtonWasHeld) {
    // Button is still being held - keep it active if we've seen a release
    bButtonHeld = bButtonReleasedThisStage;
  }
  
  // Debug: log B button state
  if (!bButtonHeld && bButtonWasHeld) {
    console.log('B button released - pushing boids away');
  }
  
  // Apply forces to boids based on B button state
  // Store state for application in boid update loop (safer than applying here)
  // Always set the variables - use window.width/height or fallback to canvas dimensions
  const canvasWidth = typeof width !== 'undefined' ? width : (window.width || 1920);
  const canvasHeight = typeof height !== 'undefined' ? height : (window.height || 1080);
  
  window.stage3AttractActive = bButtonHeld;
  if (bButtonWasHeld && !bButtonHeld) {
    // Just released - trigger one-time push
    window.stage3PushActive = true;
    console.log('Push force activated, spawn at:', canvasWidth * spawnX, canvasHeight * spawnY);
  }
  window.stage3SpawnX = canvasWidth * spawnX;
  window.stage3SpawnY = canvasHeight * spawnY;
  
  // Debug: log state periodically
  if (bButtonHeld && frameCount % 30 === 0) {
    console.log('B held - attract active:', window.stage3AttractActive, 'spawn:', window.stage3SpawnX, window.stage3SpawnY);
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
      <div class="stage-title">Stage 3: Boids Active</div>
      <div class="control-list">
        <div class="control-capsule">
          <div class="control-icon">↑↓←→</div>
          <div class="control-text">D-pad: Move spawn</div>
        </div>
        <div class="control-capsule">
          <div class="control-icon">A</div>
          <div class="control-text">A: Spawn</div>
        </div>
        <div class="control-capsule">
          <div class="control-icon">B</div>
          <div class="control-text">B: Attract/Push</div>
        </div>
      </div>
    `;
    stageOverlay.style.display = 'block';
    progressOverlay.style.display = 'none';
  }
}

function drawSpawnIndicator() {
  if (window.currentStage !== 3) return;
  
  const spawnScreenX = width * spawnX;
  const spawnScreenY = height * spawnY;
  // Shrink cursor when B is held
  const baseRadius = 8;
  const isBHeld = window.stage3 ? window.stage3.bButtonHeld : false;
  const indicatorRadius = isBHeld ? baseRadius * 0.5 : baseRadius;
  
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
  bButtonHeld = false;
  bButtonWasHeld = false;
  bButtonReleasedThisStage = false; // Reset flag - wait for button to be released first
  lastSpawnTime = 0;
  // Reset force states
  window.stage3AttractActive = false;
  window.stage3PushActive = false;
}

// Expose functions to global scope
window.stage3 = {
  handleControls: handleStage3Controls,
  drawInstructions: drawStage3Instructions,
  drawCrankDebug: drawCrankDebug,
  drawSpawnIndicator: drawSpawnIndicator,
  initialize: initializeStage3,
  // Expose B button state for cursor shrinking
  get bButtonHeld() { return bButtonHeld; }
};
