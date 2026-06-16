import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';

jest.mock('sentry/components/pageFilters/usePageFilters');

beforeEach(() => {
  jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
});

describe('BaseChartActionDropdown', () => {
  it('does not show Open in Explore when visibility-explore-view is not enabled', async () => {
    render(
      <BaseChartActionDropdown
        alertMenuOptions={[]}
        exploreUrl="/explore"
        referrer="test"
      />,
      {organization: OrganizationFixture({features: []})}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Widget actions'}));

    expect(screen.queryByText('Open in Explore')).not.toBeInTheDocument();
  });

  it('shows Open in Explore when visibility-explore-view is enabled', async () => {
    render(
      <BaseChartActionDropdown
        alertMenuOptions={[]}
        exploreUrl="/explore"
        referrer="test"
      />,
      {organization: OrganizationFixture({features: ['visibility-explore-view']})}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Widget actions'}));

    expect(screen.getByText('Open in Explore')).toBeInTheDocument();
  });
});
