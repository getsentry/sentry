export default function (stubs) {
  function RouterStub() {}

  Object.assign(RouterStub, {
    makePath() {},
    makeHref() {},
    transitionTo() {},
    replaceWith() {},
    goBack() {},
    getCurrentPath() {},
    getCurrentRoutes() {},
    getCurrentPathname() {},
    isActive() {},
    getRouteAtDepth() {},
    setRouteComponentAtDepth() {}
  }, stubs);
  return RouterStub;
}