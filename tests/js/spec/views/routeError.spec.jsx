import React from 'react';
import sdk from 'app/utils/sdk';

import {mount} from 'enzyme';
import {RouteError} from 'app/views/routeError';

jest.mock('jquery');

describe('RouteError', function() {
  beforeEach(function() {});

  it('captures errors with raven', async function() {
    let error = new Error('Big Bad Error');
    let routes = TestStubs.routes();
    mount(<RouteError routes={routes} error={error} />, TestStubs.routerContext());

    await tick();

    expect(sdk.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Big Bad Error: /:orgId/organizations/:orgId/api-keys/',
      }),
      expect.objectContaining({
        extra: expect.objectContaining({
          route: '/:orgId/organizations/:orgId/api-keys/',
        }),
      })
    );

    expect(sdk.showReportDialog).toHaveBeenCalled();
  });
});
