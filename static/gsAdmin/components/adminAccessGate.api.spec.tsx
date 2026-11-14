import {Fragment} from 'react';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {registerOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {AdminAccessGate} from 'admin/components/adminAccessGate';
import {SuperuserAccessCategory} from 'getsentry/overrides/superuserAccessCategory';

jest.unmock('sentry/api');

function AdminApp() {
  return (
    <Fragment>
      <GlobalModal />
      <AdminAccessGate>Admin content</AdminAccessGate>
    </Fragment>
  );
}

function mockAccessRequired(code: string, status = 403) {
  fetchMock.mockResponse(request => {
    const isAccessCheck = request.url.endsWith('/_admin/superuser-check/');
    return Promise.resolve({
      status: isAccessCheck ? status : 200,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(
        isAccessCheck ? {detail: {code}} : request.method === 'PUT' ? {} : []
      ),
    });
  });
}

describe('AdminAccessGate authentication', () => {
  beforeEach(() => {
    ConfigStore.set('disableU2FForSUForm', false);
    ConfigStore.set('isSelfHosted', false);
    ConfigStore.set('validateSUForm', true);
    registerOverride('component:superuser-access-category', SuperuserAccessCategory);
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify([]));
  });

  afterEach(() => fetchMock.resetMocks());

  it('opens the superuser modal and offers retry after dismissal', async () => {
    mockAccessRequired('superuser-required');
    render(<AdminApp />);

    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('textbox', {name: 'Reason for Access'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    expect(await screen.findByRole('button', {name: 'Authenticate'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Authenticate'}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('reloads after superuser authentication succeeds', async () => {
    ConfigStore.set('disableU2FForSUForm', true);
    mockAccessRequired('superuser-required');
    render(<AdminApp />);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      await within(dialog).findByRole('radio', {name: 'Development'})
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', {name: 'Reason for Access'}),
      'Investigating an issue'
    );
    await userEvent.click(within(dialog).getByRole('button', {name: 'Continue'}));
    await waitFor(() => expect(testableWindowLocation.reload).toHaveBeenCalled());
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('shows security-key authentication when staff access is required', async () => {
    mockAccessRequired('staff-required');
    render(<AdminApp />);
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('heading', {name: 'Admin access'})
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText(
        'Please add a U2F authenticator to your Sentry account'
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('textbox', {name: 'Reason for Access'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('uses staff authentication when the API requires staff', async () => {
    ConfigStore.set('disableU2FForSUForm', true);
    mockAccessRequired('staff-required');
    render(<AdminApp />);
    await waitFor(() => expect(testableWindowLocation.reload).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/0/staff-auth/',
      expect.objectContaining({method: 'PUT'})
    );
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('shows the sign-in action for an expired login', async () => {
    mockAccessRequired('not-authenticated', 401);
    render(<AdminApp />);
    expect(await screen.findByRole('button', {name: 'Sign in'})).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});
