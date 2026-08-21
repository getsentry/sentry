import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PartnershipNote} from 'getsentry/views/subscriptionPage/partnershipNote';

// The real note, verbatim from getsentry nintendo_configs.py
const NINTENDO_NOTE =
  'Contact <a href="https://developer.nintendo.com/group/development/g1kr9vj6/tech-info/crash-analysis-service-support" target="_blank" rel="noreferrer">Nintendo Developer Portal</a> support to make changes to your subscription.';

function subscriptionWithNote(supportNote: string) {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  subscription.partner = {
    externalId: 'x',
    isActive: true,
    name: '',
    partnership: {displayName: 'Nintendo', id: 'NT', supportNote},
  };
  return subscription;
}

describe('PartnershipNote', () => {
  it('preserves the partner link, including target and rel', () => {
    render(<PartnershipNote subscription={subscriptionWithNote(NINTENDO_NOTE)} />);

    const link = screen.getByRole('link', {
      name: 'Nintendo Developer Portal',
    });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('developer.nintendo.com')
    );
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
