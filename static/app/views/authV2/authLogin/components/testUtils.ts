export function mockElementFromPoint(): void {
  const descriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');

  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => null),
    });
  });

  afterAll(() => {
    if (descriptor) {
      Object.defineProperty(document, 'elementFromPoint', descriptor);
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });
}
