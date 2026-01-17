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
  
  // Crank influence folder
  const crankFolder = gui.addFolder('Crank Influence');
  crankFolder.add(window.settings, 'crankInfluenceStrength', 0, 1).step(0.01).name('Influence Strength');
  
  // Appearance folder
  const appearanceFolder = gui.addFolder('Appearance');
  appearanceFolder.add(window.settings, 'boidSize', 1, 10).step(0.5).name('Boid Size');
  
  // Brush settings folder
  const brushFolder = gui.addFolder('Brush Settings');
  brushFolder.add(window.settings, 'brushWeight', 0.5, 5).step(0.1).name('Brush Weight');
  brushFolder.add(window.settings, 'brushOpacity', 0, 255).step(1).name('Brush Opacity');
  brushFolder.add(window.settings, 'strokeLength', 2, 20).step(0.5).name('Stroke Length');
  
  // Boid variation folder
  const variationFolder = gui.addFolder('Boid Variation');
  variationFolder.add(window.settings, 'lengthMultiplierMin', 0.1, 1.5).step(0.1).name('Length Min');
  variationFolder.add(window.settings, 'lengthMultiplierMax', 1.0, 5.0).step(0.1).name('Length Max');
  variationFolder.add(window.settings, 'weightMultiplierMin', 0.1, 1.5).step(0.1).name('Weight Min');
  variationFolder.add(window.settings, 'weightMultiplierMax', 1.0, 3.0).step(0.1).name('Weight Max');
  
  // Boid management folder
  const managementFolder = gui.addFolder('Boid Management');
  managementFolder.add(window.settings, 'maxBoids', 10, 2000).step(10).name('Max Boids');
  
  // Close the GUI panel initially
  gui.close();
}

// Expose setup function
window.setupGUI = setupGUI;
