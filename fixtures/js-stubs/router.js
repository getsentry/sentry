export function router(params) {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    setRouteLeaveHook: jest.fn(),
    isActive: jest.fn(),
    createHref: jest.fn().mockImplementation(to => {
      if (typeof to === 'string') {
        return to;
      }

      if (typeof to === 'object') {
        if (!to.query) {
          return to.pathname;
        }

        return `${to.pathname}?${qs.stringify(to.query)}`;
      }

      return '';
    }),
    location: TestStubs.location(),
    createPath: jest.fn(),
    routes: [],
    params: {},
    ...params,
  };
}
