import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {BillingType} from 'getsentry/types';

import {DataConsentForm} from './dataConsentForm';

describe('DataConsentForm', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('user', UserFixture({isSuperuser: false}));
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/',
      method: 'GET',
      body: SubscriptionFixture({organization: OrganizationFixture()}),
    });
  });

  it('enables the switch with billing access and self-serve subscription', async () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      type: BillingType.CREDIT_CARD,
    });

    render(<DataConsentForm subscription={subscription} />, {organization});

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
  });

  it('disables the switch without billing access', () => {
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({
      organization,
      type: BillingType.CREDIT_CARD,
    });

    render(<DataConsentForm subscription={subscription} />, {organization});

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('disables the switch for invoiced customer needing MSA update', () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      type: BillingType.INVOICED,
      msaUpdatedForDataConsent: false,
    });

    render(<DataConsentForm subscription={subscription} />, {organization});

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('enables the switch for invoiced customer with MSA updated', () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      type: BillingType.INVOICED,
      msaUpdatedForDataConsent: true,
    });

    render(<DataConsentForm subscription={subscription} />, {organization});

    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('enables the switch for superuser even without billing access', () => {
    ConfigStore.set('user', UserFixture({isSuperuser: true}));
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({
      organization,
      type: BillingType.CREDIT_CARD,
    });

    render(<DataConsentForm subscription={subscription} />, {organization});

    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('enables the switch for superuser even with invoiced MSA needing update', () => {
    ConfigStore.set('user', UserFixture({isSuperuser: true}));
    const organization = OrganizationFixture({access: []});
    const subscription = SubscriptionFixture({
      organization,
      type: BillingType.INVOICED,
      msaUpdatedForDataConsent: false,
    });

    render(<DataConsentForm subscription={subscription} />, {organization});

    expect(screen.getByRole('checkbox')).toBeEnabled();
  });
});
