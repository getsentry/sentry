import * as Sentry from '@sentry/react';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {useRoutes} from 'sentry/utils/useRoutes';
import RouteError from 'sentry/views/routeError';

jest.mock('sentry/utils/useRoutes');

jest
  .mocked(useRoutes)
  .mockReturnValue([
    {path: '/'},
    {path: '/:orgId/'},
    {path: '/organizations/:orgId/'},
    {path: 'api-keys/'},
  ]);

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
