for (const specifier of [
  'nuqs',
  'nuqs/adapters/custom',
  'nuqs/adapters/testing',
  'nuqs/adapters/react-router/v6',
]) {
  const actualNuqs = jest.requireActual<Record<string, unknown>>(specifier);
  jest.doMock(specifier, () => actualNuqs);
}
