/**
 * Runs after the test framework is installed, so `expect`, `beforeEach` and
 * friends are available here.
 */
// NOTE: @testing-library/react-native v12.4+ registers its jest matchers
// (toBeOnTheScreen, toBeDisabled, ...) automatically. The old
// `@testing-library/react-native/extend-expect` import no longer exists.

// Fail a test if a component logs an error/warning that indicates a real bug
// (missing keys, act() violations, prop type errors). Comment out if too noisy
// while you're mid-refactor.
const originalError = console.error;

beforeAll(() => {
  console.error = (...args) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    if (message.includes('not wrapped in act(')) {
      // act() warnings almost always mean a state update escaped the test's
      // control and the assertion below it is unreliable.
      throw new Error(`console.error: ${message}`);
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
