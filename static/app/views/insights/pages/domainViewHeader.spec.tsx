import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DomainViewHeader} from 'sentry/views/insights/pages/domainViewHeader';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useOrganization');

describe('DomainViewHeader', function () {
  const organization = OrganizationFixture({
    features: ['insights-entry-points'],
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(useLocation).mockReturnValue({
      pathname: '/organizations/org-slug/insights/frontend/',
    } as Location);
    jest.mocked(useOrganization).mockReturnValue(organization);
  });

  it('renders', () => {
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
  });

  it('does not show network requests without features', () => {
    jest.mocked(useOrganization).mockReturnValue(OrganizationFixture());
    render(
      <DomainViewHeader
        domainBaseUrl="domainBaseUrl"
        domainTitle="domainTitle"
        modules={[ModuleName.HTTP]}
        selectedModule={undefined}
      />
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
      />
    );

    expect(screen.getByText('domainTitle')).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Overview'})).not.toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Network Requests'})).toBeInTheDocument();
  });
});
