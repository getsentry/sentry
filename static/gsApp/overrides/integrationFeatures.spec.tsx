import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {PlanTier} from 'getsentry-test/planTier';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {hookIntegrationFeatures} from 'getsentry/overrides/integrationFeatures';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

/**
 * `IntegrationFeatures` only invokes its render callback once `withSubscription`
 * has a subscription *and* the react-query billing config fetch has settled, so
 * nothing is asserted synchronously after `render()`. That settle is effectively
 * instant locally, but on a loaded CI shard a stall longer than RTL's 1s default
 * expires the wait before the callback ever runs, which surfaces as a
 * `Number of calls: 0` flake. Give the wait real headroom -- a passing test still
 * resolves on the first poll, so this only slows down genuine failures.
 */
const RENDER_CALLBACK_TIMEOUT = 10_000;

describe('hookIntegrationFeatures', () => {
  const {FeatureList, IntegrationFeatures} = hookIntegrationFeatures();

  const organization = OrganizationFixture();

  ConfigStore.set('user', UserFixture({isSuperuser: true}));
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'upsell'},
      body: BillingConfigFixture(PlanTier.AM2),
    });
  });

  it('does not gate free-only feature sets', async () => {
    const sub = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, sub);

    const features = [
      {
        description: 'Some non-plan feature',
        featureGate: 'non-plan-feature',
      },
      {
        description: 'Another non-plan feature',
        featureGate: 'non-plan-feature2',
      },
    ];

    const renderCallback = jest.fn(() => <Fragment />);

    render(
      <IntegrationFeatures {...{organization, features}}>
        {renderCallback}
      </IntegrationFeatures>
    );

    await waitFor(
      () => {
        expect(renderCallback).toHaveBeenCalledWith({
          disabled: false,
          disabledReason: null,
          ungatedFeatures: features,
          gatedFeatureGroups: [],
        });
      },
      {timeout: RENDER_CALLBACK_TIMEOUT}
    );
  });

  it.isKnownFlake(
    'gates premium only features and requires upgrade with free plan',
    async () => {
      const sub = SubscriptionFixture({organization});
      SubscriptionStore.set(organization.slug, sub);

      const features = [
        {
          description: 'Some non-plan feature',
          featureGate: 'integrations-issue-basic',
        },
        {
          description: 'Another non-plan feature',
          featureGate: 'integrations-event-hooks',
        },
      ];

      const renderCallback = jest.fn(() => <Fragment />);

      render(
        <IntegrationFeatures {...{organization, features}}>
          {renderCallback}
        </IntegrationFeatures>
      );

      await waitFor(
        () => {
          expect(renderCallback).toHaveBeenCalledWith({
            disabled: true,
            disabledReason: expect.anything(), // TODO use matching that will work with a React component
            ungatedFeatures: [],
            gatedFeatureGroups: [
              {
                plan: PlanDetailsLookupFixture('am2_team'),
                features: [features[0]],
                hasFeatures: false,
              },
              {
                plan: PlanDetailsLookupFixture('am2_business'),
                features: [features[1]],
                hasFeatures: false,
              },
            ],
          });
        },
        {timeout: RENDER_CALLBACK_TIMEOUT}
      );
    }
  );

  describe('FeatureList and IntegrationFeatures that distinguish free and premium', () => {
    const sub = SubscriptionFixture({organization, plan: 'am2_team'});
    SubscriptionStore.set(organization.slug, sub);

    // Fixtures do not add features based on plan. Manually add the
    // integrations-issue-basic feature for this organizations feature
    beforeEach(() => {
      organization.features = ['integrations-issue-basic'];
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-config/`,
        query: {tier: 'upsell'},
        body: BillingConfigFixture(PlanTier.AM2),
      });
    });

    afterEach(() => {
      organization.features = [];
    });

    const features = [
      {
        description: 'Some non-plan feature',
        featureGate: 'non-plan-feature',
      },
      {
        description: 'Issue basic plan feature',
        featureGate: 'integrations-issue-basic',
      },
      {
        description: 'Event hooks plan feature',
        featureGate: 'integrations-event-hooks',
      },
    ];

    it('renders with the correct callback', async () => {
      const renderCallback = jest.fn(() => <Fragment />);

      render(
        <IntegrationFeatures {...{organization, features}}>
          {renderCallback}
        </IntegrationFeatures>
      );

      await waitFor(
        () => {
          expect(renderCallback).toHaveBeenCalledWith({
            disabled: false,
            disabledReason: null,
            ungatedFeatures: [features[0]],
            gatedFeatureGroups: [
              {
                plan: PlanDetailsLookupFixture('am2_team'),
                features: [features[1]],
                hasFeatures: true,
              },
              {
                plan: PlanDetailsLookupFixture('am2_business'),
                features: [features[2]],
                hasFeatures: false,
              },
            ],
          });
        },
        {timeout: RENDER_CALLBACK_TIMEOUT}
      );
    });

    it('renders feature list', async () => {
      render(
        <FeatureList
          provider={{key: 'example'}}
          organization={organization}
          features={features}
        />
      );

      expect(await screen.findByText('Some non-plan feature')).toBeInTheDocument();
      expect(screen.getByText('Issue basic plan feature')).toBeInTheDocument();
      expect(screen.getByText('Event hooks plan feature')).toBeInTheDocument();
    });

    it('renders no plan required for `non-plan-feature` feature', async () => {
      render(
        <FeatureList
          provider={{key: 'example'}}
          organization={organization}
          features={[features[0]!]}
        />
      );

      expect(await screen.findByText('All billing plans')).toBeInTheDocument();
      expect(screen.getByText('Some non-plan feature')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    it('renders team plan required for `integrations-issue-basic` feature', async () => {
      render(
        <FeatureList
          provider={{key: 'example'}}
          organization={organization}
          features={[features[1]!]}
        />
      );

      expect(await screen.findByText('Team billing plans')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('Issue basic plan feature')).toBeInTheDocument();
    });

    it('renders biz plan required for `integrations-event-hooks` feature', async () => {
      render(
        <FeatureList
          provider={{key: 'example'}}
          organization={organization}
          features={[features[2]!]}
        />
      );
      expect(await screen.findByText('Business billing plans')).toBeInTheDocument();
      expect(screen.getByText('Request Trial')).toBeInTheDocument();
      expect(screen.getByText('Event hooks plan feature')).toBeInTheDocument();
    });
  });

  describe('Gates features available ONLY on am2 plans', () => {
    const features = [
      {
        description: 'Link stack trace to source code.',
        featureGate: 'integrations-stacktrace-link',
      },
    ];

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-config/`,
        query: {tier: 'upsell'},
        body: BillingConfigFixture(PlanTier.AM2),
      });
    });

    it('free features enabled when on any am2 plan', async () => {
      organization.features = ['integrations-stacktrace-link'];

      const sub = SubscriptionFixture({organization, plan: 'am2_team'});
      SubscriptionStore.set(organization.slug, sub);

      render(
        <FeatureList
          provider={{key: 'example'}}
          organization={organization}
          features={[features[0]!]}
        />
      );
      expect(await screen.findByText('Developer billing plans')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('Link stack trace to source code.')).toBeInTheDocument();
    });

    it('renders required performance plan am1 free features when on legacy plan', async () => {
      organization.features = [];
      const sub = SubscriptionFixture({organization, plan: 's1', isFree: false});
      SubscriptionStore.set(organization.slug, sub);

      render(
        <FeatureList
          provider={{key: 'example'}}
          organization={organization}
          features={[features[0]!]}
        />
      );
      expect(await screen.findByText('Developer billing plans')).toBeInTheDocument();
      expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
      expect(screen.getByText('Link stack trace to source code.')).toBeInTheDocument();
    });
  });
});
