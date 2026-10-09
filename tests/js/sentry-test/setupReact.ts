const actualReact = jest.requireActual<typeof import('react')>('react');

// Automock generation evaluates dependencies in a separate module registry.
// Keep the real React instance shared so nuqs can reuse its adapter context.
jest.doMock('react', () => actualReact);
