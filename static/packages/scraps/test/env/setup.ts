import '@testing-library/jest-dom';

import {configure} from '@testing-library/react';

configure({testIdAttribute: 'data-test-id'});

// jsdom does not implement ResizeObserver. Layout tests can supply measured sizes.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not lay out elements. Skip Floating UI's geometry work and the
// React updates it schedules; overlay interactions still use the real component
// code. Positioning tests can opt back in with jest.unmock('@floating-ui/react-dom').
jest.mock('@floating-ui/react-dom', () => {
  const {useState} = jest.requireActual<typeof import('react')>('react');
  const update = () => {};
  const useFloating: typeof import('@floating-ui/react-dom').useFloating = ({
    placement = 'bottom',
    strategy = 'absolute',
  } = {}) => {
    const [refs] = useState(() => {
      const reference: {current: any} = {current: null};
      const floating: {current: HTMLElement | null} = {current: null};
      return {
        reference,
        floating,
        setReference: (node: unknown) => {
          reference.current = node;
        },
        setFloating: (node: HTMLElement | null) => {
          floating.current = node;
        },
      };
    });

    return {
      x: 0,
      y: 0,
      placement,
      strategy,
      middlewareData: {},
      isPositioned: false,
      update,
      refs,
      elements: {reference: null, floating: null},
      floatingStyles: {position: strategy, left: 0, top: 0},
    };
  };
  return {...jest.requireActual('@floating-ui/react-dom'), useFloating};
});
