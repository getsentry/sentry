import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {AdminAccessGate} from 'admin/components/adminAccessGate';

const url = '/_admin/superuser-check/';

function AdminContent() {
  return <div>Admin content</div>;
}

function AdminApp() {
  return (
    <AdminAccessGate>
      <AdminContent />
    </AdminAccessGate>
  );
}

describe('AdminAccessGate', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('getsentry.adminAccessMode', 'superuser');
    ConfigStore.set('disableU2FForSUForm', false);
    MockApiClient.addMockResponse({url: '/authenticators/', body: []});
  });

  it('mounts admin content only after access is verified', async () => {
    MockApiClient.addMockResponse({url, body: null});
    render(<AdminApp />);
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(await screen.findByText('Admin content')).toBeInTheDocument();
  });

  it('shows the superuser form for an inactive session', async () => {
    MockApiClient.addMockResponse({url, statusCode: 403});
    render(<AdminApp />);
    expect(
      await screen.findByRole('heading', {name: 'Superuser access'})
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('textbox', {name: 'Reason for Access'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('uses staff mode selected by the server', async () => {
    ConfigStore.set('getsentry.adminAccessMode', 'staff');
    MockApiClient.addMockResponse({url, statusCode: 403});
    render(<AdminApp />);
    expect(
      await screen.findByRole('heading', {name: 'Admin access'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Reason for Access'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('retries verification after a server error', async () => {
    MockApiClient.addMockResponse({url, statusCode: 502});
    render(<AdminApp />);
    expect(await screen.findByText('Unable to verify admin access.')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    MockApiClient.addMockResponse({url, body: null});
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(await screen.findByText('Admin content')).toBeInTheDocument();
  });

  it('returns to the server login flow for an expired session', async () => {
    MockApiClient.addMockResponse({url, statusCode: 401});
    render(<AdminApp />);
    await userEvent.click(await screen.findByRole('button', {name: 'Sign in'}));
    expect(testableWindowLocation.reload).toHaveBeenCalled();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});
