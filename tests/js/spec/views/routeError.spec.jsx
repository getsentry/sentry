import React from 'react';
import * as Sentry from '@sentry/browser';

import {mount} from 'sentry-test/enzyme';

import {RouteError} from 'app/views/routeError';

jest.mock('jquery');

describe('RouteError', function() {
  afterEach(function() {
    Sentry.captureException.mockClear();
    Sentry.showReportDialog.mockClear();
  });

  it('captures errors with raven', async function() {
    const error = new Error('Big Bad Error');
    const routes = TestStubs.routes();
    mount(<RouteError routes={routes} error={error} />, TestStubs.routerContext());

    await tick();

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Big Bad Error: /organizations/:orgId/api-keys/',
      })
    );

    expect(Sentry.showReportDialog).toHaveBeenCalled();
  });
});
