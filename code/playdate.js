// Playdate input handling module

let playdateDevice = null;
let previousButtonStates = {};
let currentCrankAngle = null;
let previousCrankAngle = null;
let lastCrankChangeTime = 0;
let isCrankDocked = true; // Start as docked
let isPollingControls = false;
let pdUsbModule = null;
const CRANK_INACTIVE_THRESHOLD = 200; // ms - if crank hasn't changed in this time, stop influence

// Expose these to global scope for other modules
window.playdate = {
  getCrankAngle: () => currentCrankAngle,
  isCrankDocked: () => isCrankDocked,
  isConnected: () => playdateDevice !== null,
  isCrankActive: () => {
    // Crank is active if it's not docked, has a valid angle, and has changed recently
    if (isCrankDocked || currentCrankAngle === null || isNaN(currentCrankAngle)) {
      return false;
    }
    const now = Date.now();
    const timeSinceChange = now - lastCrankChangeTime;
    return timeSinceChange < CRANK_INACTIVE_THRESHOLD;
  },
  // Internal setters for direct updates from sketch.js
  _setCrankAngle: (angle) => { 
    const oldAngle = currentCrankAngle;
    currentCrankAngle = angle;
    // Update activity timestamp ONLY when angle actually changes
    if (angle !== null && !isNaN(angle)) {
      const angleChanged = (oldAngle === null || Math.abs(oldAngle - angle) > 0.1);
      if (angleChanged) {
        previousCrankAngle = oldAngle;
        lastCrankChangeTime = Date.now();
      }
      // Don't update timestamp if angle hasn't changed - this allows status to become inactive
    }
  },
  _setCrankDocked: (docked) => { isCrankDocked = docked; }
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
    
    // Set up cleanup on page unload
    setupPageUnloadCleanup();
    
    // Set up cleanup on page unload
    setupPageUnloadCleanup();
    
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
    
    // Set up callbacks after connection is established
    if (window.playdate && window.playdate.setButtonPressCallback && window.handleButtonPress) {
      window.playdate.setButtonPressCallback(window.handleButtonPress);
      console.log('Button press callback set after connection');
    }
    if (window.playdate && window.playdate.setControlsUpdateCallback && window.handleControlsUpdate) {
      window.playdate.setControlsUpdateCallback(window.handleControlsUpdate);
      console.log('Controls update callback set after connection');
    }
    
    // Move to stage 2 after successful connection
    if (window.setStage) {
      window.setStage(2);
    }
  } catch (error) {
    console.error('Failed to connect to Playdate:', error);
    alert('Failed to connect to Playdate: ' + error.message + '\n\nMake sure it is connected via USB and unlocked.');
    playdateDevice = null;
  }
}

function handleControlsUpdate(state) {
  // Debug: log state structure once to see what properties are available
  if (!window._loggedStateStructure) {
    console.log('State object structure:', Object.keys(state));
    console.log('State object:', state);
    window._loggedStateStructure = true;
  }
  
  // Call the main sketch's controls update handler if set
  if (onControlsUpdateCallback) {
    onControlsUpdateCallback(state);
  }
  
  // Check for button presses (for stage 3 boid spawning)
  const buttons = ['a', 'b', 'up', 'down', 'left', 'right', 'menu', 'lock'];
  
  for (let button of buttons) {
    // Check both buttonDown and pressed properties
    const isPressed = (state.buttonDown && state.buttonDown[button]) || 
                      (state.pressed && state.pressed[button]) || false;
    const wasPressed = previousButtonStates[button] || false;
    
    // Detect new button press (transition from not pressed to pressed)
    if (isPressed && !wasPressed && onButtonPressCallback) {
      console.log('Button press detected:', button);
      onButtonPressCallback();
    }
    
    previousButtonStates[button] = isPressed;
  }
  
  // Update current crank angle and dock status (used to influence boid direction)
  // This should work in all stages, including stage 3
  // Check multiple possible property names for crank angle
  let crankValue = state.crank;
  if (crankValue === undefined || crankValue === null) {
    // Try alternative property names
    crankValue = state.crankAngle;
  }
  if (crankValue === undefined || crankValue === null) {
    crankValue = state.crankValue;
  }
  
  // Check for explicit dock status - check multiple possible property names
  let explicitDocked = undefined;
  if (state.crankDocked !== undefined) {
    explicitDocked = state.crankDocked;
  } else if (state.isCrankDocked !== undefined) {
    explicitDocked = state.isCrankDocked;
  } else if (state.docked !== undefined) {
    explicitDocked = state.docked;
  } else if (state.crank && state.crank.docked !== undefined) {
    explicitDocked = state.crank.docked;
  }
  
  // Update crank angle if we have a valid value
  if (crankValue !== undefined && crankValue !== null && !isNaN(crankValue)) {
    const oldAngle = currentCrankAngle;
    currentCrankAngle = crankValue;
    // If we have a crank angle, it's definitely undocked
    isCrankDocked = false;
    
    // Track activity - update timestamp ONLY when angle actually changes
    // This allows status to become inactive after 0.2s of no movement
    const angleChanged = (oldAngle === null || Math.abs(oldAngle - currentCrankAngle) > 0.1);
    if (angleChanged) {
      previousCrankAngle = oldAngle;
      lastCrankChangeTime = Date.now();
    }
    // Don't update timestamp if angle hasn't changed - allows status to become inactive
  } else {
    // No crank angle in this update
    // If we have explicit dock information, use it
    if (explicitDocked !== undefined) {
      isCrankDocked = explicitDocked;
      // Only clear angle if explicitly docked
      if (explicitDocked === true) {
        currentCrankAngle = null;
        previousCrankAngle = null;
        lastCrankChangeTime = 0;
      }
    } else {
      // No explicit dock info and no crank value
      // If we never had a crank angle, assume docked
      if (currentCrankAngle === null && previousCrankAngle === null && lastCrankChangeTime === 0) {
        // Never had a crank angle - assume docked
        isCrankDocked = true;
      } else if (currentCrankAngle !== null) {
        // We had an angle before but aren't getting updates now
        // Check if it's been a while since last update - if so, might be docked
        const timeSinceLastUpdate = Date.now() - lastCrankChangeTime;
        // If no updates for 1 second, infer that it's likely docked
        if (timeSinceLastUpdate > 1000) {
          isCrankDocked = true;
          currentCrankAngle = null;
          previousCrankAngle = null;
          lastCrankChangeTime = 0;
        }
        // Otherwise keep current state (might just be slow updates)
      }
    }
  }
}

// Callback for controls update (set by main sketch)
let onControlsUpdateCallback = null;

function setControlsUpdateCallback(callback) {
  onControlsUpdateCallback = callback;
}

window.playdate.setControlsUpdateCallback = setControlsUpdateCallback;

// Cleanup function to properly disconnect from Playdate
async function cleanupPlaydateConnection() {
  if (playdateDevice) {
    try {
      // Stop polling controls if active
      if (isPollingControls && playdateDevice.stopPollingControls) {
        await playdateDevice.stopPollingControls();
        isPollingControls = false;
      }
      
      // Close serial connection if open
      if (playdateDevice.serial && playdateDevice.serial.isOpen) {
        if (playdateDevice.serial.close && typeof playdateDevice.serial.close === 'function') {
          await playdateDevice.serial.close();
        }
      }
      
      console.log('Playdate connection cleaned up');
    } catch (error) {
      console.warn('Error during Playdate cleanup:', error);
    } finally {
      playdateDevice = null;
    }
  }
}

// Set up page unload handlers
function setupPageUnloadCleanup() {
  // Only set up once
  if (window._playdateCleanupSetup) {
    return;
  }
  window._playdateCleanupSetup = true;
  
  // Handle page unload/refresh
  window.addEventListener('beforeunload', (event) => {
    // Cleanup synchronously if possible
    if (playdateDevice && isPollingControls) {
      try {
        if (playdateDevice.stopPollingControls) {
          // Try to stop polling (may not complete, but we try)
          playdateDevice.stopPollingControls().catch(() => {});
        }
      } catch (e) {
        // Ignore errors during unload
      }
    }
  });
  
  // Cleanup on page unload (fires after beforeunload)
  window.addEventListener('unload', () => {
    cleanupPlaydateConnection().catch(() => {
      // Ignore errors during unload - browser is closing
    });
  });
  
  // Also handle page visibility change (tab switch, minimize, etc.)
  document.addEventListener('visibilitychange', () => {
    // Optionally pause/resume polling when tab is hidden
    // For now, we'll keep it running
  });
}

// Expose cleanup function
window.playdate.cleanup = cleanupPlaydateConnection;

// Expose connect function
window.connectToPlaydate = connectToPlaydate;
