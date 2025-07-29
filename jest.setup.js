// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock SharedArrayBuffer
Object.defineProperty(window, 'SharedArrayBuffer', {
  value: ArrayBuffer,
  writable: true,
});

// Mock AudioContext
Object.defineProperty(window, 'AudioContext', {
  value: class MockAudioContext {},
  writable: true,
});

// Suppress console.log for tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}