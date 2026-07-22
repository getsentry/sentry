import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SuperuserStaffAccessForm from 'sentry/components/superuserStaffAccessForm';
import {registerOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';

describe('SuperuserStaffAccessForm', () => {
  beforeEach(() => {
    ConfigStore.set('disableU2FForSUForm', false);

    // The superuser access category / reason fields are provided by a getsentry
    // override that is not registered in the jest environment. Register a light
    // stub so the non-staff form branch renders the same field names.
    registerOverride('component:superuser-access-category', () => (
      <input aria-label="Reason for Access" name="superuserReason" />
    ));

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/authenticators/',
      body: [{id: 'u2f', challenge: {}}],
    });
  });

  it('renders the access form, override, and buttons for superusers', async () => {
    render(<SuperuserStaffAccessForm hasStaff={false} />);

    expect(await screen.findByLabelText('Reason for Access')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'COPS/CSM'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('hides the access form after the first submit to prompt for WebAuthn', async () => {
    render(<SuperuserStaffAccessForm hasStaff={false} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Continue'}));

    // The access category / reason override is replaced by the WebAuthn prompt.
    await waitFor(() => {
      expect(screen.queryByLabelText('Reason for Access')).not.toBeInTheDocument();
    });
  });
});
