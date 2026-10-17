import '@testing-library/jest-dom';

import {configure} from '@testing-library/react';

configure({testIdAttribute: 'data-test-id'});

// jsdom does not implement ResizeObserver. Layout tests can supply measured sizes.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
