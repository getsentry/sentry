export function routerContext([context, childContextTypes] = []) {
  return {
    context: {
      location: TestStubs.location(),
      router: TestStubs.router(),
      organization: fixtures.Organization(),
      project: fixtures.Project(),
      ...context,
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
      project: PropTypes.object,
      ...childContextTypes,
    },
  };
}
