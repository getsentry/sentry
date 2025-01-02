import {AuditLogsFixture} from 'sentry-fixture/auditLogs';
import {AuditLogsApiEventNamesFixture} from 'sentry-fixture/auditLogsApiEventNames';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

// XXX(epurkhiser): This appears to also be tested by ./index.spec.tsx

describe('OrganizationAuditLog', function () {
  const {organization, router} = initializeOrg({
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
      body: {rows: AuditLogsFixture(), options: AuditLogsApiEventNamesFixture()},
    });
  });

  it('renders', async function () {
    render(<OrganizationAuditLog location={router.location} />, {
      router,
    });

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
      body: {rows: [], options: AuditLogsApiEventNamesFixture()},
    });

    render(<OrganizationAuditLog location={router.location} />, {
      router,
    });

    expect(await screen.findByText('No audit entries available')).toBeInTheDocument();
  });

  it('displays whether an action was done by a superuser', async () => {
    render(<OrganizationAuditLog location={router.location} />, {
      router,
    });

    expect(await screen.findByText('Sentry Staff')).toBeInTheDocument();
    expect(screen.getAllByText('Foo Bar')).toHaveLength(2);
  });

  it('replaces rule and alertrule audit types in dropdown', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: {
        rows: AuditLogsFixture(),
        options: ['rule.edit', 'alertrule.edit', 'member.add'],
      },
    });

    render(<OrganizationAuditLog location={router.location} />, {
      router,
    });

    await userEvent.click(screen.getByText('Select Action:'));

    expect(screen.getByText('issue-alert.edit')).toBeInTheDocument();
    expect(screen.getByText('metric-alert.edit')).toBeInTheDocument();
    expect(screen.getByText('member.add')).toBeInTheDocument();
  });

  it('replaces text in rule and alertrule entries', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/audit-logs/`,
      method: 'GET',
      body: {
        rows: [
          {
            actor: UserFixture(),
            event: 'rule.edit',
            ipAddress: '127.0.0.1',
            id: '214',
            note: 'edited rule "New issue"',
            targetObject: 123,
            targetUser: null,
            data: {},
          },
          {
            actor: UserFixture(),
            event: 'alertrule.edit',
            ipAddress: '127.0.0.1',
            id: '215',
            note: 'edited metric alert rule "Failure rate too high"',
            targetObject: 456,
            targetUser: null,
            data: {},
          },
        ],
        options: AuditLogsApiEventNamesFixture(),
      },
    });

    render(<OrganizationAuditLog location={router.location} />, {
      router,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // rule.edit -> issue-alert.edit
    expect(screen.getByText('issue-alert.edit')).toBeInTheDocument();
    expect(screen.getByText('edited issue alert rule "New issue"')).toBeInTheDocument();

    // alertrule.edit -> metric-alert.edit
    expect(screen.getByText('metric-alert.edit')).toBeInTheDocument();
    expect(
      screen.getByText('edited metric alert rule "Failure rate too high"')
    ).toBeInTheDocument();
  });
});
