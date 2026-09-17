import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PartnershipNote} from 'getsentry/views/subscriptionPage/partnershipNote';

// A partner support note with an inline link, matching what partners configure.
const PARTNER_NOTE =
  'Contact <a href="https://partner.example.com/support" target="_blank" rel="noreferrer">Partner Support Portal</a> support to make changes to your subscription.';

function subscriptionWithNote(supportNote: string) {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  subscription.partner = {
    externalId: 'x',
    isActive: true,
    name: '',
    partnership: {displayName: 'Partner', id: 'PN', supportNote},
  };
  return subscription;
}

describe('PartnershipNote', () => {
  it('preserves the partner link, including target and rel', () => {
    render(<PartnershipNote subscription={subscriptionWithNote(PARTNER_NOTE)} />);

    const link = screen.getByRole('link', {
      name: 'Partner Support Portal',
    });
    expect(link).toHaveAttribute('href', expect.stringContaining('partner.example.com'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByText(/support to make changes/)).toBeInTheDocument();
  });

  it('strips script tags and event handlers', () => {
    render(
      <PartnershipNote
        subscription={subscriptionWithNote(
          'Hi<script>window.pwned=1</script><img src=x onerror="window.pwned=1">there'
        )}
      />
    );

    const note = screen.getByTestId('partnership-note');
    expect(note.querySelector('script')).toBeNull();
    expect(note.querySelector('[onerror]')).toBeNull();
    expect(note).toHaveTextContent('Hithere');
  });

  it('falls back to the default message with no partner', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});
    render(<PartnershipNote subscription={subscription} />);

    expect(screen.getByText(/Contact us at/)).toBeInTheDocument();
  });
});
