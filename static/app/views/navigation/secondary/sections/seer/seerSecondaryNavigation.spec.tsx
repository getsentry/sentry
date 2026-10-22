import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

describe('SeerSecondaryNavigation', () => {
  const organization = OrganizationFixture({
    features: ['investigations'],
    openMembership: true,
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/all-queries/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/broadcasts/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  function renderNavigation(pathname: string) {
    render(
      <PrimaryNavigationContextProvider>
        <Navigation />
      </PrimaryNavigationContextProvider>,
      {organization, initialRouterConfig: {location: {pathname}}}
    );
  }

  it('renders the Investigations link', () => {
    renderNavigation('/organizations/org-slug/seer/investigations/');

    expect(screen.getByRole('link', {name: 'Investigations'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/investigations/'
    );
  });

  it('marks Investigations as active on investigation detail pages', () => {
    renderNavigation('/organizations/org-slug/seer/investigations/investigation-1/');

    expect(screen.getByRole('link', {name: 'Investigations'})).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
