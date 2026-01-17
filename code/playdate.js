// Playdate input handling module

let playdateDevice = null;
let previousButtonStates = {};
let currentCrankAngle = null;
let isCrankDocked = true; // Start as docked
let isPollingControls = false;
let pdUsbModule = null;

// Expose these to global scope for other modules
window.playdate = {
  getCrankAngle: () => currentCrankAngle,
  isCrankDocked: () => isCrankDocked,
  isConnected: () => playdateDevice !== null
};

// Callback for when a button is pressed (set by main sketch)
let onButtonPressCallback = null;

function setButtonPressCallback(callback) {
  onButtonPressCallback = callback;
}

window.playdate.setButtonPressCallback = setButtonPressCallback;

async function connectToPlaydate() {
  try {
    // Dynamically import pd-usb if not already loaded
    if (!pdUsbModule) {
      pdUsbModule = await import('https://unpkg.com/pd-usb?module');
    }
    
    playdateDevice = await pdUsbModule.requestConnectPlaydate();
    console.log('Connected to Playdate!', playdateDevice);
    
    // Debug: Check device structure
    console.log('Device properties:', Object.keys(playdateDevice));
    if (playdateDevice.serial) {
      console.log('Serial object:', playdateDevice.serial);
      console.log('Serial isOpen:', playdateDevice.serial.isOpen);
      
      // Try to open serial if it exists and isn't open
      if (playdateDevice.serial.open && typeof playdateDevice.serial.open === 'function') {
        if (!playdateDevice.serial.isOpen) {
          console.log('Attempting to open serial...');
          await playdateDevice.serial.open();
          console.log('Serial opened successfully');
        } else {
          console.log('Serial already open');
        }
      }
    }
    
    // Set up event handlers before starting polling
    playdateDevice.on('controls:update', handleControlsUpdate);
    playdateDevice.on('disconnect', () => {
      console.log('Playdate disconnected');
      playdateDevice = null;
      isPollingControls = false;
    });
    
    // Verify we can communicate by getting version info first
    // This ensures the connection is fully established and serial is open
    try {
      const version = await playdateDevice.getVersion();
      console.log('Playdate version:', version);
    } catch (e) {
      console.error('Could not get version:', e);
      // This might fail if serial isn't open, but let's continue
    }
    
    // Now start polling controls
    await playdateDevice.startPollingControls();
    isPollingControls = true;
    console.log('Started polling controls');
  } catch (error) {
    console.error('Failed to connect to Playdate:', error);
    alert('Failed to connect to Playdate: ' + error.message + '\n\nMake sure it is connected via USB and unlocked.');
    playdateDevice = null;
  }
}

function handleControlsUpdate(state) {
  // Check for button presses
  const buttons = ['a', 'b', 'up', 'down', 'left', 'right', 'menu', 'lock'];
  
  for (let button of buttons) {
    // Check both buttonDown and pressed properties
    const isPressed = (state.buttonDown && state.buttonDown[button]) || 
                      (state.pressed && state.pressed[button]) || false;
    const wasPressed = previousButtonStates[button] || false;
    
    // Detect new button press (transition from not pressed to pressed)
    if (isPressed && !wasPressed && onButtonPressCallback) {
      onButtonPressCallback();
    }
    
    previousButtonStates[button] = isPressed;
  }
  
  // Update current crank angle and dock status (used to influence boid direction)
  if (state.crank !== undefined && state.crank !== null && !isNaN(state.crank)) {
    currentCrankAngle = state.crank;
  }
  
  // Check if crank is docked
  // The state might have crankDocked, isCrankDocked, or we can use the device method
  if (playdateDevice && playdateDevice.isCrankDocked && typeof playdateDevice.isCrankDocked === 'function') {
    isCrankDocked = playdateDevice.isCrankDocked();
  } else if (state.crankDocked !== undefined) {
    isCrankDocked = state.crankDocked;
  } else if (state.isCrankDocked !== undefined) {
    isCrankDocked = state.isCrankDocked;
  }
}

// Expose connect function
window.connectToPlaydate = connectToPlaydate;
