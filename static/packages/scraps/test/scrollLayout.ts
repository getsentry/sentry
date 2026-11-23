/**
 * jsdom does not lay out or scroll. Stubs element geometry for the tests of the
 * calling `describe` block, so a virtualized list has a viewport and room to
 * scroll: elements are 100px tall with 50,000px of content, an element's top
 * moves up as its ancestors scroll, and `scrollTo` scrolls.
 *
 * Scroll an element in a test with `fireEvent.scroll(element, {target: {scrollTop}})`.
 */
export function stubScrollLayout() {
  const stubs: Array<[typeof Element.prototype, string, PropertyDescriptor]> = [
    [HTMLElement.prototype, 'offsetHeight', {get: () => 100}],
    [Element.prototype, 'clientHeight', {get: () => 100}],
    [Element.prototype, 'scrollHeight', {get: () => 50_000}],
    [
      Element.prototype,
      'getBoundingClientRect',
      {
        value(this: Element) {
          let top = 0;
          for (let el = this.parentElement; el; el = el.parentElement) {
            top -= el.scrollTop;
          }
          return new DOMRect(0, top, 0, 0);
        },
      },
    ],
    [
      Element.prototype,
      'scrollTo',
      {
        value(this: Element, options?: ScrollToOptions) {
          this.scrollTop = options?.top ?? this.scrollTop;
          this.dispatchEvent(new Event('scroll'));
        },
      },
    ],
  ];
  const originals = stubs.map(
    ([target, name]) =>
      [target, name, Object.getOwnPropertyDescriptor(target, name)] as const
  );

  beforeEach(() => {
    for (const [target, name, descriptor] of stubs) {
      Object.defineProperty(target, name, {configurable: true, ...descriptor});
    }
  });

  afterEach(() => {
    for (const [target, name, descriptor] of originals) {
      if (descriptor) {
        Object.defineProperty(target, name, descriptor);
      } else {
        Reflect.deleteProperty(target, name);
      }
    }
  });
}
