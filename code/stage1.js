// Stage 1: Connection stage

// Update connection UI visibility
function updateConnectionUI() {
  const connectionUI = document.getElementById('connection-ui');
  const stageOverlay = document.getElementById('stage-overlay');
  
  if (connectionUI && stageOverlay) {
    if (window.currentStage === 1) {
      connectionUI.style.display = 'block';
      stageOverlay.style.display = 'none';
    } else {
      connectionUI.style.display = 'none';
      stageOverlay.style.display = 'block';
    }
  }
}

function drawStage1Instructions() {
  const stageOverlay = document.getElementById('stage-overlay');
  const stageContent = document.getElementById('stage-content');
  const progressOverlay = document.getElementById('progress-overlay');
  
  if (window.currentStage === 1) {
    stageContent.innerHTML = 'Stage 1: Connect your Playdate';
    stageOverlay.style.display = 'block';
    progressOverlay.style.display = 'none';
  }
}

// Expose functions to global scope
window.stage1 = {
  updateConnectionUI: updateConnectionUI,
  drawInstructions: drawStage1Instructions
};
