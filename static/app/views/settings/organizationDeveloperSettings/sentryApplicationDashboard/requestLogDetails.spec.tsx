import {ProjectFixture} from 'sentry-fixture/project';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppWebhookRequestFixture} from 'sentry-fixture/sentryAppWebhookRequest';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {SentryAppWebhookRequest} from 'sentry/types/integrations';
import {RequestLog} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/requestLog';

describe('RequestLog details drawer', () => {
  const sentryApp = SentryAppFixture({status: 'published'});

  function mockRequests(...requests: SentryAppWebhookRequest[]) {
    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/webhook-requests/`,
      body: requests,
    });
  }

  async function openDrawer() {
    await userEvent.click(
      await screen.findByRole('button', {name: 'View request details'})
    );
    return await screen.findByRole('complementary', {name: 'Webhook request details'});
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('opens with a summary of the request', async () => {
    mockRequests(SentryAppWebhookRequestFixture());
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('Status Code')).toBeInTheDocument();
    expect(within(drawer).getByText('400')).toBeInTheDocument();
    expect(within(drawer).getByText('issue.assigned')).toBeInTheDocument();
    expect(within(drawer).getByText('https://example.com/webhook')).toBeInTheDocument();
    expect(within(drawer).getByText('Test Org')).toBeInTheDocument();
  });

  it('renders request headers', async () => {
    mockRequests(
      SentryAppWebhookRequestFixture({
        request_headers: {
          'Content-Type': 'application/json',
          'X-Custom-Token': '*'.repeat(64),
        },
      })
    );
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('Content-Type')).toBeInTheDocument();
    expect(within(drawer).getByText('application/json')).toBeInTheDocument();
    expect(within(drawer).getByText('X-Custom-Token')).toBeInTheDocument();
    expect(within(drawer).getByText('*'.repeat(64))).toBeInTheDocument();
  });

  it('decodes a double-encoded body into structured data', async () => {
    mockRequests(
      SentryAppWebhookRequestFixture({
        request_body: JSON.stringify(JSON.stringify({action: 'assigned'})),
      })
    );
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('Request Body')).toBeInTheDocument();
    expect(within(drawer).getByText('"action"')).toBeInTheDocument();
    expect(within(drawer).getByText('"assigned"')).toBeInTheDocument();
  });

  it('falls back to raw text for a body that is not JSON', async () => {
    mockRequests(SentryAppWebhookRequestFixture({response_body: 'Unauthorized'}));
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('Response Body')).toBeInTheDocument();
    expect(within(drawer).getByText('Unauthorized')).toBeInTheDocument();
    expect(within(drawer).queryByText('(truncated)')).not.toBeInTheDocument();
  });

  it('unescapes a truncated double-encoded body', async () => {
    mockRequests(
      SentryAppWebhookRequestFixture({
        response_body: JSON.stringify(
          JSON.stringify({detail: 'something went wrong'})
        ).slice(0, 30),
      })
    );
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('{"detail":"something went')).toBeInTheDocument();
    expect(within(drawer).getByText('(truncated)')).toBeInTheDocument();
  });

  it('links a captured error to its event when the project resolves', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '7', slug: 'my-project'})]);
    mockRequests(SentryAppWebhookRequestFixture({error_id: 'abc123', project_id: 7}));
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByRole('link', {name: 'abc123'})).toHaveAttribute(
      'href',
      '/test-org/my-project/events/abc123/'
    );
  });

  it('shows the error id as text when the project is unknown', async () => {
    mockRequests(SentryAppWebhookRequestFixture({error_id: 'abc123', project_id: 7}));
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('abc123')).toBeInTheDocument();
    expect(within(drawer).queryByRole('link', {name: 'abc123'})).not.toBeInTheDocument();
  });

  it('shows only the summary for a request with no captured detail', async () => {
    mockRequests(SentryAppWebhookRequestFixture({responseCode: 200}));
    render(<RequestLog app={sentryApp} />);

    const drawer = await openDrawer();

    expect(within(drawer).getByText('Summary')).toBeInTheDocument();
    expect(within(drawer).queryByText('Request Headers')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('Request Body')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('Response Body')).not.toBeInTheDocument();
  });
});
