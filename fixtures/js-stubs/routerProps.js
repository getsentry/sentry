export function routerProps(params = {}) {
  return {
    location: TestStubs.location(),
    params: {},
    routes: [],
    stepBack: () => {},
    ...params,
  };
}
