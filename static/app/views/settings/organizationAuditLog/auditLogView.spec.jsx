import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

describe('OrganizationAuditLog', () => {
  const {routerContext, org} = initializeOrg({
    projects: [],
    router: {
      params: {orgId: 'org-slug'},
    },
  });
  const ENDPOINT = `/organizations/${org.slug}/audit-logs/`;
  const mockLocation = {query: {}};

  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: {rows: TestStubs.AuditLogs(), options: TestStubs.AuditLogsApiEventNames()},
    });
  });

  it('renders', async () => {
    render(
      <OrganizationAuditLog
        location={mockLocation}
        organization={org}
        params={{orgId: org.slug}}
      />,
      {
        context: routerContext,
      }
    );

    expect(await screen.findByRole('heading')).toHaveTextContent('Audit Log');
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('IP')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.queryByText('No audit entries available')).not.toBeInTheDocument();
    expect(screen.getByText('edited project ludic-science')).toBeInTheDocument();
  });

  it('renders empty', async () => {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: {rows: [], options: TestStubs.AuditLogsApiEventNames()},
    });

    render(
      <OrganizationAuditLog
        location={mockLocation}
        organization={org}
        params={{orgId: org.slug}}
      />,
      {
        context: routerContext,
      }
    );

    expect(await screen.findByText('No audit entries available')).toBeInTheDocument();
  });

  it('displays whether an action was done by a superuser', async () => {
    render(
      <OrganizationAuditLog
        location={mockLocation}
        organization={org}
        params={{orgId: org.slug}}
      />,
      {
        context: routerContext,
      }
    );

    expect(await screen.findByText('Sentry Staff')).toBeInTheDocument();
    expect(screen.getAllByText('Foo Bar')).toHaveLength(2);
  });
});
