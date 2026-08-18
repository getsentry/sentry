import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PiiEncryption} from 'sentry/views/settings/components/piiEncryption';

const PUBLIC_KEY = 'hL8xQ0mZ3vT7pKdN9sRfY2wJc1AoUiE4bXgVzHnQmS0=';

describe('PiiEncryption', () => {
  it('lets a member with org:write save a public key', async () => {
    render(<PiiEncryption />, {
      organization: OrganizationFixture({access: ['org:write']}),
    });

    const notice = screen.getByText(
      'Only values captured after this change can be sealed.'
    );
    expect(notice).not.toBeVisible();

    await userEvent.type(screen.getByLabelText('Public key'), PUBLIC_KEY);
    expect(notice).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    // Saving resets the form to pristine, which hides the notice again.
    await waitFor(() => {
      expect(notice).not.toBeVisible();
    });
    expect(screen.getByLabelText('Public key')).toHaveValue(PUBLIC_KEY);
  });

  it('rejects a key that is not base64-encoded 32-byte key material', async () => {
    render(<PiiEncryption />, {
      organization: OrganizationFixture({access: ['org:write']}),
    });

    await userEvent.type(screen.getByLabelText('Public key'), 'not-a-key');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('Enter a base64-encoded 32-byte public key')
    ).toBeInTheDocument();
  });

  it('does not offer editing without org:write', () => {
    render(<PiiEncryption />, {organization: OrganizationFixture({access: []})});

    expect(screen.getByLabelText('Public key')).toBeDisabled();
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
  });
});
