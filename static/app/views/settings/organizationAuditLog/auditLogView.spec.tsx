import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

// XXX(epurkhiser): This appears to also be tested by ./index.spec.tsx

describe('OrganizationAuditLog', function () {
  const {routerContext, organization, router} = initializeOrg({
    ...initializeOrg(),
    projects: [],
    router: {
      params: {orgId: 'org-slug'},
    },
  });
  const ENDPOINT = `/organizations/${organization.slug}/audit-logs/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: {rows: TestStubs.AuditLogs(), options: TestStubs.AuditLogsApiEventNames()},
    });
  });

  it('renders', async function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <OrganizationAuditLog location={router.location} />
      </OrganizationContext.Provider>,
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

  it('renders empty', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: {rows: [], options: TestStubs.AuditLogsApiEventNames()},
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <OrganizationAuditLog location={router.location} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    expect(await screen.findByText('No audit entries available')).toBeInTheDocument();
  });

  it('displays whether an action was done by a superuser', async () => {
    render(
      <OrganizationContext.Provider value={organization}>
        <OrganizationAuditLog location={router.location} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    expect(await screen.findByText('Sentry Staff')).toBeInTheDocument();
    expect(screen.getAllByText('Foo Bar')).toHaveLength(2);
  });
});
