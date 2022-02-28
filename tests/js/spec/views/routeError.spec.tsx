import * as Sentry from '@sentry/react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {RouteError} from 'sentry/views/routeError';

describe('RouteError', function () {
  const {router, routerContext, organization} = initializeOrg({
    ...initializeOrg(),
    router: TestStubs.router({
      routes: [
        {path: '/'},
        {path: '/:orgId/'},
        {name: 'this should be skipped'},
        {path: '/organizations/:orgId/'},
        {path: 'api-keys/', name: 'API Key'},
      ],
    }),
  });

  const {location, params, routes} = router;

  it('captures errors with sentry', async function () {
    render(
      <RouteError
        router={router}
        routes={routes}
        error={new Error('Big Bad Error')}
        location={location}
        params={params}
        organization={organization}
      />,
      {
        context: routerContext,
      }
    );

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
