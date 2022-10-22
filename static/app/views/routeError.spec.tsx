import * as Sentry from '@sentry/react';
import {router} from 'fixtures/js-stubs/router.js';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import RouteError from 'sentry/views/routeError';

describe('RouteError', function () {
  const {routerContext} = initializeOrg({
    ...initializeOrg(),
    router: router({
      routes: [
        {path: '/'},
        {path: '/:orgId/'},
        {name: 'this should be skipped'},
        {path: '/organizations/:orgId/'},
        {path: 'api-keys/', name: 'API Key'},
      ],
    }),
  });

  it('captures errors with sentry', async function () {
    render(<RouteError error={new Error('Big Bad Error')} />, {
      context: routerContext,
    });

    await waitFor(() =>
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Big Bad Error: /organizations/:orgId/api-keys/',
        })
      )
    );

    expect(Sentry.showReportDialog).toHaveBeenCalled();
  });
});
