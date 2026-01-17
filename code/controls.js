// Control panel GUI module

let gui;

function setupGUI() {
  gui = new dat.GUI({ name: 'Boid Controls' });
  
  // Flocking parameters folder
  const flockingFolder = gui.addFolder('Flocking Behavior');
  flockingFolder.add(window.settings, 'separationWeight', 0, 5).step(0.1).name('Separation Weight');
  flockingFolder.add(window.settings, 'alignmentWeight', 0, 5).step(0.1).name('Alignment Weight');
  flockingFolder.add(window.settings, 'cohesionWeight', 0, 5).step(0.1).name('Cohesion Weight');
  flockingFolder.add(window.settings, 'maxSpeed', 0.5, 10).step(0.1).name('Max Speed');
  flockingFolder.add(window.settings, 'maxForce', 0.01, 0.2).step(0.01).name('Max Force');
  flockingFolder.add(window.settings, 'desiredSeparation', 10, 100).step(1).name('Desired Separation');
  flockingFolder.add(window.settings, 'neighborDistance', 20, 200).step(5).name('Neighbor Distance');
  flockingFolder.open();
  
  // Crank influence folder
  const crankFolder = gui.addFolder('Crank Influence');
  crankFolder.add(window.settings, 'crankInfluenceStrength', 0, 1).step(0.01).name('Influence Strength');
  crankFolder.open();
  
  // Appearance folder
  const appearanceFolder = gui.addFolder('Appearance');
  appearanceFolder.add(window.settings, 'boidSize', 1, 10).step(0.5).name('Boid Size');
  appearanceFolder.open();
}

// Expose setup function
window.setupGUI = setupGUI;
