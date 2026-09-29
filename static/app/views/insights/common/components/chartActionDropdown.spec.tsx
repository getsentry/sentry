import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';

beforeEach(() => {
  PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
});

afterEach(() => {
  PageFiltersStore.reset();
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
