import * as Sentry from '@sentry/react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {RouteError} from 'sentry/views/routeError';

describe('RouteError', function () {
  const routes = [
    {path: '/'},
    {path: '/:orgId/'},
    {name: 'this should be skipped'},
    {path: '/organizations/:orgId/'},
    {path: 'api-keys/', name: 'API Key'},
  ];

  afterEach(function () {
    Sentry.captureException.mockClear();
    Sentry.showReportDialog.mockClear();
  });

  it('captures errors with sentry', async function () {
    const error = new Error('Big Bad Error');
    mountWithTheme(
      <RouteError routes={routes} error={error} />,
      TestStubs.routerContext()
    );

    await tick();

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Big Bad Error: /organizations/:orgId/api-keys/',
      })
    );

    expect(Sentry.showReportDialog).toHaveBeenCalled();
  });
});
