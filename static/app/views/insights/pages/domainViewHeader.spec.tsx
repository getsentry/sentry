import type {Location, Query} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {DomainViewHeader} from 'sentry/views/insights/pages/domainViewHeader';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/utils/useLocation');

const useLocationMock = jest.mocked(useLocation);

describe('DomainViewHeader', function () {
  const organization = OrganizationFixture({
    features: ['insights-entry-points'],
  });

  beforeEach(() => {
    jest.resetAllMocks();
    useLocationMock.mockReturnValue({
      pathname: '/organizations/org-slug/insights/frontend/',
    } as Location);
  });

  it('renders', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />,
      {organization, deprecatedRouterMocks: true}
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
  });

  it('renders link with page filters', () => {
    useLocationMock.mockClear();
    useLocationMock.mockReturnValue({
      pathname: '/organizations/org-slug/insights/frontend/',
      query: {
        project: ['1'],
        environment: ['prod'],
        statsPeriod: '14d',
        transaction: '123',
      } as Query,
    } as Location);

    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />,
      {organization, deprecatedRouterMocks: true}
    );

    const overviewTab = screen.getByRole('tab', {name: 'Overview'});
    const networkRequestsTab = screen.getByRole('tab', {name: 'Network Requests'});
    expect(overviewTab.firstChild).toHaveAttribute(
      'href',
      '/mock-pathname/domainBaseUrl?environment=prod&project=1&statsPeriod=14d'
    );
    expect(networkRequestsTab.firstChild).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/frontend/http/?environment=prod&project=1&statsPeriod=14d'
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
      {organization: organizationWithoutFeatures, deprecatedRouterMocks: true}
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Network Requests'})).not.toBeInTheDocument();
  });

  it('does not show overview tab with hasOverviewPage=false', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
        hasOverviewPage={false}
      />,
      {organization, deprecatedRouterMocks: true}
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Overview'})).not.toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
  });

  it('renders a new badge only for mobile vitals', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP, ModuleName.MOBILE_VITALS]}
        selectedModule={undefined}
        hasOverviewPage={false}
      />,
      {organization, deprecatedRouterMocks: true}
    );
    expect(screen.getByRole('tab', {name: 'Mobile Vitals new'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', {name: 'Network Requests new'})
    ).not.toBeInTheDocument();
  });
});
