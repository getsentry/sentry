import * as Sentry from '@sentry/react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import RouteError from 'sentry/views/routeError';

describe('RouteError', () => {
  const {router} = initializeOrg({
    router: {
      routes: [
        {path: '/'},
        {path: '/:orgId/'},
        {name: 'this should be skipped'},
        {path: '/organizations/:orgId/'},
        {path: 'api-keys/', name: 'API Key'},
      ],
    },
  });

  it('captures errors with sentry', async () => {
    render(<RouteError error={new Error('Big Bad Error')} />, {
      router,
      deprecatedRouterMocks: true,
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
