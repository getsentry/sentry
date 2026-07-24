import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SuperuserStaffAccessForm from 'sentry/components/superuserStaffAccessForm';
import {registerOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import type {SuperuserAccessCategoryProps} from 'sentry/types/overrides';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

function TestAccessCategory({
  accessCategory,
  accessCategoryError,
  onAccessCategoryChange,
  onReasonChange,
  reason,
  reasonError,
}: SuperuserAccessCategoryProps) {
  return (
    <div>
      <label>
        <input
          checked={accessCategory === 'development'}
          name="superuserAccessCategory"
          type="radio"
          onChange={() => onAccessCategoryChange?.('development')}
        />
        Development
      </label>
      {accessCategoryError ? <div role="alert">{accessCategoryError}</div> : null}
      <label>
        Reason for Access
        <input
          name="superuserReason"
          value={reason ?? ''}
          onChange={event => onReasonChange?.(event.target.value)}
        />
      </label>
      {reasonError ? <div role="alert">{reasonError}</div> : null}
    </div>
  );
}

function addAuthenticatorResponse(body: unknown[] = [{id: 'u2f', challenge: {}}]) {
  return MockApiClient.addMockResponse({
    url: '/authenticators/',
    body,
  });
}

async function waitForAccessForm() {
  await waitFor(() => {
    expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
  });
}

describe('SuperuserStaffAccessForm', () => {
  beforeEach(() => {
    ConfigStore.set('disableU2FForSUForm', false);
    registerOverride('component:superuser-access-category', TestAccessCategory);
    MockApiClient.clearMockResponses();
  });

  it('validates the access category and reason before starting WebAuthn', async () => {
    addAuthenticatorResponse();
    render(<SuperuserStaffAccessForm hasStaff={false} />);
    await waitForAccessForm();

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByText('Select an access category')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a reason of at least 4 characters')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Change reason'})).not.toBeInTheDocument();
  });

  it('captures access details before starting WebAuthn', async () => {
    addAuthenticatorResponse();
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'PUT',
    });
    render(<SuperuserStaffAccessForm hasStaff={false} />);
    await waitForAccessForm();

    await userEvent.click(screen.getByRole('radio', {name: 'Development'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Reason for Access'}),
      'Investigating an issue'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(
      await screen.findByRole('button', {name: 'Change reason'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Reason for Access'})
    ).not.toBeInTheDocument();
    expect(authRequest).not.toHaveBeenCalled();
  });

  it('submits the bound access details when U2F is disabled', async () => {
    ConfigStore.set('disableU2FForSUForm', true);
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'PUT',
    });
    render(<SuperuserStaffAccessForm hasStaff={false} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Development'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Reason for Access'}),
      'Investigating an issue'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(authRequest).toHaveBeenCalledWith(
        '/auth/',
        expect.objectContaining({
          method: 'PUT',
          data: {
            isSuperuserModal: true,
            superuserAccessCategory: 'development',
            superuserReason: 'Investigating an issue',
          },
        })
      );
    });
    expect(testableWindowLocation.reload).toHaveBeenCalled();
  });

  it('submits the COPS/CSM access details through the form', async () => {
    ConfigStore.set('disableU2FForSUForm', true);
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'PUT',
    });
    render(<SuperuserStaffAccessForm hasStaff={false} />);

    await userEvent.click(screen.getByRole('button', {name: 'COPS/CSM'}));

    await waitFor(() => {
      expect(authRequest).toHaveBeenCalledWith(
        '/auth/',
        expect.objectContaining({
          method: 'PUT',
          data: {
            isSuperuserModal: true,
            superuserAccessCategory: 'cops_csm',
            superuserReason: 'COPS and CSM use',
          },
        })
      );
    });
  });

  it('shows an error and disables submission when no authenticator is available', async () => {
    addAuthenticatorResponse([]);
    render(<SuperuserStaffAccessForm hasStaff={false} />);

    expect(
      await screen.findByText('Please add a U2F authenticator to your Sentry account')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'COPS/CSM'})).toBeDisabled();
  });

  it('automatically authenticates staff when U2F is disabled', async () => {
    ConfigStore.set('disableU2FForSUForm', true);
    const authRequest = MockApiClient.addMockResponse({
      url: '/staff-auth/',
      method: 'PUT',
    });
    render(<SuperuserStaffAccessForm hasStaff />);

    await waitFor(() => {
      expect(authRequest).toHaveBeenCalledWith(
        '/staff-auth/',
        expect.objectContaining({
          method: 'PUT',
          data: {superuserAccessCategory: '', superuserReason: ''},
        })
      );
    });
    expect(testableWindowLocation.reload).toHaveBeenCalled();
  });
});
