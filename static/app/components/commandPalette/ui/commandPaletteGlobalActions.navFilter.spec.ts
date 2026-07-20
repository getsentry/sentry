import type {NavigationGroupProps} from 'sentry/views/settings/types';

import {isNavItemVisible} from './commandPaletteGlobalActions';

// A minimal context; the filter logic only uses it when `show` is a function.
const ctx = {} as NavigationGroupProps;

describe('isNavItemVisible', () => {
  it('shows items with no show constraint', () => {
    expect(isNavItemVisible({}, ctx)).toBe(true);
  });

  it('hides items with show: false', () => {
    expect(isNavItemVisible({show: false}, ctx)).toBe(false);
  });

  it('shows items with show: true', () => {
    expect(isNavItemVisible({show: true}, ctx)).toBe(true);
  });

  it('calls a show function and returns its result', () => {
    expect(isNavItemVisible({show: () => false}, ctx)).toBe(false);
    expect(isNavItemVisible({show: () => true}, ctx)).toBe(true);
  });

  it('passes context to the show function', () => {
    const showFn = jest.fn(() => true);
    const fullCtx = {access: new Set(['org:read'])} as unknown as NavigationGroupProps;
    isNavItemVisible({show: showFn}, fullCtx);
    expect(showFn).toHaveBeenCalledWith(fullCtx);
  });
});
