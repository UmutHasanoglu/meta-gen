import '@testing-library/jest-dom';

// Mock crypto.subtle for tests
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: async (_algorithm: string, data: Uint8Array) => {
        // Simple mock - returns predictable hash based on data length
        const result = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          result[i] = (data.length + i) % 256;
        }
        return result.buffer;
      },
    },
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});
