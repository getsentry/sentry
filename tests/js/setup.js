jest.mock('app/translations');

import jQuery from 'jquery';
window.$ = window.jQuery = jQuery;

import sinon from 'sinon';
window.sinon = sinon;

window.TestStubs = {
  // react-router's 'router' context
  router: () => ({
    push: sinon.spy(),
    replace: sinon.spy(),
    go: sinon.spy(),
    goBack: sinon.spy(),
    goForward: sinon.spy(),
    setRouteLeaveHook: sinon.spy(),
    isActive: sinon.spy()
  })
};
