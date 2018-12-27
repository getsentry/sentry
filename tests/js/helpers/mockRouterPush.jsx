// More closely mocks a router push -- updates wrapper's props/context
// with updated `router` and calls `wrapper.update()`
export function mockRouterPush(wrapper, router) {
  router.push.mockImplementation(({pathname, query}) => {
    const location = {
      ...router.location,
      query,
    };
    let newRouter = {
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
