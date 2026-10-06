import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {OpenSeerButton} from './openSeerButton';
import type {OverviewRun} from './types';

jest.mock('sentry/utils/analytics');

const organization = OrganizationFixture();

const run = (overrides: Partial<OverviewRun> = {}): OverviewRun =>
  ({groupId: '2', shortId: 'SEER-1', seerRunId: 'run-1', ...overrides}) as OverviewRun;

describe('OpenSeerButton', () => {
  it('opens the seer drawer for the run and tracks the click', async () => {
    const {router} = render(
      <OpenSeerButton run={run()} section="needs_investigation" size="xs" />,
      {
        organization,
        initialRouterConfig: {location: {pathname: '/seer/overview/'}},
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open Seer'}));

    expect(router.location.query.seerDrawer).toBe('2');
    expect(trackAnalytics).toHaveBeenCalledWith(
      'autofix.overview.open_seer_clicked',
      expect.objectContaining({
        organization,
        group_id: '2',
        run_id: 'run-1',
        section: 'needs_investigation',
      })
    );
  });
});
