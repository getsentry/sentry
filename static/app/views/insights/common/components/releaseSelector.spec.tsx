import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

jest.mock('sentry/views/insights/common/queries/useReleases', () => ({
  useReleases: () => ({
    data: [
      {dateCreated: '2024-01-01T00:00:00Z', version: 'v1.0.0', count: 10},
      {dateCreated: '2024-01-02T00:00:00Z', version: 'v2.0.0', count: 20},
    ],
    isLoading: false,
  }),
  useReleaseSelection: () => ({
    primaryRelease: undefined,
    isLoading: false,
  }),
}));

describe('ReleaseComparisonSelector analytics', () => {
  it('tracks primary release selection with module name and release', async () => {
    const organization = OrganizationFixture();

    render(<ReleaseComparisonSelector moduleName={ModuleName.MOBILE_VITALS} />, {
      organization,
    });

    const primaryTrigger = screen.getByRole('button', {name: 'Filter Release'});
    await userEvent.click(primaryTrigger);

    const option = await screen.findByRole('option', {name: 'v2.0.0'});
    await userEvent.click(option);

    expect(trackAnalytics).toHaveBeenCalledWith(
      'insights.release.select_release',
      expect.objectContaining({
        organization,
        moduleName: ModuleName.MOBILE_VITALS,
        filtered: true,
        type: 'primary',
      })
    );

    await userEvent.click(primaryTrigger);
    const allOption = await screen.findByRole('option', {name: 'All'});
    await userEvent.click(allOption);

    expect(trackAnalytics).toHaveBeenCalledWith(
      'insights.release.select_release',
      expect.objectContaining({
        organization,
        moduleName: ModuleName.MOBILE_VITALS,
        filtered: false,
        type: 'primary',
      })
    );
  });
});
