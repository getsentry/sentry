import qs from 'query-string';

// More closely mocks a router push -- updates wrapper's props/context
// with updated `router` and calls `wrapper.update()`
export function mockRouterPush(wrapper, router) {
  router.push.mockImplementation(({query}) => {
    const stringifiedQuery = qs.stringify(query);
    const location = {
      ...router.location,

      // Need to make sure query more closely reflects datatypes in browser
      // e.g. if we had a param that was boolean, it would get stringified
      query: qs.parse(stringifiedQuery),
      search: stringifiedQuery,
    };

    const newRouter = {
      router: {
        ...router,
        location,
      },
      location,
    };
    wrapper.setProps(newRouter);
    wrapper.setContext(newRouter);

    wrapper.update();
  });
}
