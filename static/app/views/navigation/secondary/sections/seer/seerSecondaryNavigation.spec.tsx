import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

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

  function renderNavigation(pathname: string, org = organization) {
    render(
      <PrimaryNavigationContextProvider>
        <Navigation />
      </PrimaryNavigationContextProvider>,
      {organization: org, initialRouterConfig: {location: {pathname}}}
    );
  }

  it('renders the Investigations link with an alpha badge', () => {
    renderNavigation('/organizations/org-slug/seer/investigations/');

    const investigations = screen.getByRole('link', {name: /Investigations/});
    expect(investigations).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/investigations/'
    );
    expect(within(investigations).getByLabelText('alpha')).toBeInTheDocument();
  });

  it('marks Investigations as active on investigation detail pages', () => {
    renderNavigation('/organizations/org-slug/seer/investigations/investigation-1/');

    expect(screen.getByRole('link', {name: /Investigations/})).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it.each([
    ['investigations is disabled', {features: [], openMembership: true}],
    ['membership is closed', {features: ['investigations'], openMembership: false}],
  ])('renders no Seer sidebar content when %s', (_, orgProps) => {
    renderNavigation(
      '/organizations/org-slug/seer/investigations/',
      OrganizationFixture(orgProps)
    );

    expect(screen.queryByRole('link', {name: /Investigations/})).not.toBeInTheDocument();
  });
});
