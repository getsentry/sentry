import * as Sentry from '@sentry/react';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import RouteError from 'sentry/views/routeError';

jest.mock('sentry/utils/getRouteStringFromRoutes');
jest.mocked(getRouteStringFromRoutes).mockReturnValue('/organizations/:orgId/api-keys/');

describe('RouteError', () => {
  it('captures errors with sentry', async () => {
    render(<RouteError error={new Error('Big Bad Error')} />);

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
