/**
 * Tanstack Virtual renders zero items in the default zero-sized JSDom environment.
 * This forces all elements to have a non-zero size to render at least a few rows.
 * https://github.com/TanStack/virtual/issues/641
 */
export function mockGetBoundingClientRect() {
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    width: 500,
    height: 500,
    top: 0,
    left: 0,
    bottom: 500,
    right: 500,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
}
