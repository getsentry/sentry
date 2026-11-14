import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {BaseChartActionDropdown} from './chartActionDropdown';

beforeEach(() => {
  PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
});

afterEach(() => {
  PageFiltersStore.reset();
});

describe('BaseChartActionDropdown', () => {
  it('shows Open in Explore', async () => {
    render(
      <BaseChartActionDropdown
        alertMenuOptions={[]}
        exploreUrl="/explore"
        referrer="test"
      />,
      {organization: OrganizationFixture({features: []})}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Widget actions'}));

    expect(screen.getByText('Open in Explore')).toBeInTheDocument();
  });
});
