import {Modal} from 'react-bootstrap';
import React from 'react';

import {RedirectToProjectModal} from 'app/components/modals/redirectToProject';
import {mount} from 'enzyme';

jest.unmock('app/utils/recreateRoute');
describe('RedirectToProjectModal', function() {
  jest.useFakeTimers();
  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  beforeEach(function() {
    sinon.stub(window.location, 'assign');
  });

  afterEach(function() {
    window.location.assign.restore();
  });

  it('has timer to redirect to new slug after mounting', function() {
    mount(
      <RedirectToProjectModal
        routes={routes}
        params={{orgId: 'org-slug', projectId: 'project-slug'}}
        slug="new-slug"
        Header={Modal.Header}
        Body={Modal.Body}
      />,
      TestStubs.routerContext()
    );

    jest.advanceTimersByTime(4900);
    expect(window.location.assign.calledOnce).toBe(false);

    jest.advanceTimersByTime(200);
    expect(window.location.assign.calledOnce).toBe(true);
    expect(window.location.assign.calledWith('/org-slug/new-slug/')).toBe(true);
  });
});
