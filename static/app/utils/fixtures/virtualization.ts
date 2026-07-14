interface MockElementSizeOptions {
  height?: number;
  width?: number;
}

/**
 * TanStack Virtual renders zero items in the default zero-sized JSDOM environment.
 * Mock the element dimensions read by the virtualizer so it can calculate a range.
 * The bounding rect remains mocked for components that perform their own layout reads.
 */
export function mockElementSize({
  width = 500,
  height = 500,
}: MockElementSizeOptions = {}) {
  // TanStack Virtual uses offset dimensions to measure its viewport and items.
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);

  // Keep component layout reads consistent with the dimensions seen by the virtualizer.
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}
