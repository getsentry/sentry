import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ModuleName} from 'sentry/views/insights/types';

import {DomainViewHeader} from './domainViewHeader';

describe('DomainViewHeader', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });

  const baseRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/insights/frontend/`,
      query: {},
    },
    route: '/organizations/:orgId/insights/frontend/',
  };

  it('renders', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />,
      {organization, initialRouterConfig: baseRouterConfig}
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
  });

  it('renders link with page filters', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />,
      {
        organization,
        initialRouterConfig: {
          ...baseRouterConfig,
          location: {
            ...baseRouterConfig.location,
            query: {
              project: ['1'],
              environment: ['prod'],
              statsPeriod: '14d',
              transaction: '123',
            },
          },
        },
      }
    );

    const overviewTab = screen.getByRole('tab', {name: 'Overview'});
    const networkRequestsTab = screen.getByRole('tab', {name: 'Network Requests'});
    expect(overviewTab).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/insights/frontend/domainBaseUrl?environment=prod&project=1&statsPeriod=14d`
    );
    expect(networkRequestsTab).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/insights/frontend/http/?environment=prod&project=1&statsPeriod=14d`
    );
  });

  it('does not show network requests without features', () => {
    const organizationWithoutFeatures = OrganizationFixture();
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />,
      {
        organization: organizationWithoutFeatures,
        initialRouterConfig: baseRouterConfig,
      }
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Network Requests'})).not.toBeInTheDocument();
  });

  it('renders the title without a parent trail when there are no additional breadcrumbs', async () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />,
      {organization, initialRouterConfig: baseRouterConfig}
    );

    expect(
      await screen.findByRole('heading', {name: 'domainTitle', level: 1})
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders the domain and additional breadcrumbs as parents of the title', async () => {
    render(
      <DomainViewHeader
        domainBaseUrl="/domainBaseUrl/"
        domainTitle="domainTitle"
        headerTitle="Screen Name"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
        additionalBreadCrumbs={[
          {type: 'link', label: 'Mobile Vitals', to: '/mobile-vitals/'},
        ]}
      />,
      {
        organization,
        initialRouterConfig: {
          ...baseRouterConfig,
          location: {
            ...baseRouterConfig.location,
            query: {project: ['1'], statsPeriod: '14d', transaction: '123'},
          },
        },
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Screen Name', level: 1})
    ).toBeInTheDocument();

    const breadcrumbs = screen.getByRole('list');
    expect(within(breadcrumbs).getByRole('link', {name: 'domainTitle'})).toHaveAttribute(
      'href',
      '/domainBaseUrl/?project=1&statsPeriod=14d'
    );
    expect(
      within(breadcrumbs).getByRole('link', {name: 'Mobile Vitals'})
    ).toHaveAttribute('href', '/mobile-vitals/');
    expect(within(breadcrumbs).queryByText('Screen Name')).not.toBeInTheDocument();
  });

  it('renders a new badge only for mobile vitals', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP, ModuleName.MOBILE_VITALS]}
        selectedModule={undefined}
      />,
      {organization, initialRouterConfig: baseRouterConfig}
    );
    expect(screen.getByRole('tab', {name: 'Mobile Vitals new'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', {name: 'Network Requests new'})
    ).not.toBeInTheDocument();
  });
});
