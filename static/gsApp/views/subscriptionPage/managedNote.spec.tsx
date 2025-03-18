import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BillingType} from 'getsentry/types';
import ManagedNote from 'getsentry/views/subscriptionPage/managedNote';

describe('ManagedNote', function () {
  const organization = OrganizationFixture();

  it('renders nothing when subscription can self-serve', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: true,
    });

    const {container} = render(<ManagedNote subscription={subscription} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for VC partner', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      partner: {
        externalId: 'x123x',
        name: 'Org',
        partnership: {
          id: 'VC',
          displayName: 'XX',
          supportNote: '',
        },
        isActive: true,
      },
    });

    const {container} = render(<ManagedNote subscription={subscription} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders sales message for invoiced subscriptions', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      type: BillingType.INVOICED,
    });

    render(<ManagedNote subscription={subscription} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:sales@sentry.io');
    expect(screen.getByTestId('managed-note')).toHaveTextContent(
      'Contact us at sales@sentry.io to make changes to your subscription.'
    );
  });

  it('renders sales message for custom price subscriptions', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      customPrice: 100,
    });

    render(<ManagedNote subscription={subscription} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:sales@sentry.io');
    expect(screen.getByTestId('managed-note')).toHaveTextContent(
      'Contact us at sales@sentry.io to make changes to your subscription.'
    );
  });

  it('renders GitHub marketplace message for GitHub partner', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      partner: {
        externalId: 'x123x',
        name: 'GitHub Org',
        partnership: {
          id: 'GH',
          displayName: 'GitHub',
          supportNote: '',
        },
        isActive: true,
      },
    });

    render(<ManagedNote subscription={subscription} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://github.com/marketplace/sentry'
    );
    expect(screen.getByTestId('managed-note')).toHaveTextContent(
      'Visit the GitHub Marketplace to make changes to your subscription.'
    );
  });

  it('renders Heroku dashboard message for Heroku partner', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      partner: {
        externalId: 'x123x',
        name: 'Heroku Org',
        partnership: {
          id: 'HK',
          displayName: 'Heroku',
          supportNote: '',
        },
        isActive: true,
      },
    });

    render(<ManagedNote subscription={subscription} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://dashboard.heroku.com'
    );
    expect(screen.getByTestId('managed-note')).toHaveTextContent(
      'Visit the Heroku Dashboard to make changes to your subscription.'
    );
  });

  it('renders default support message for other cases', function () {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
    });

    render(<ManagedNote subscription={subscription} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:support@sentry.io');
    expect(screen.getByTestId('managed-note')).toHaveTextContent(
      'Contact us at support@sentry.io to make changes to your subscription.'
    );
  });
});
