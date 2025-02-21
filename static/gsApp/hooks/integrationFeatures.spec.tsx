import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import hookIntegrationFeatures from 'getsentry/hooks/integrationFeatures';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('hookIntegrationFeatures', function () {
  const {FeatureList, IntegrationFeatures} = hookIntegrationFeatures();

  const organization = OrganizationFixture({experiments: {}});

  ConfigStore.set('user', UserFixture({isSuperuser: true}));
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am2'},
      body: BillingConfigFixture(PlanTier.AM2),
    });
  });

  it('does not gate free-only feature sets', async function () {
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

    await waitFor(() => {
      expect(renderCallback).toHaveBeenCalledWith({
        disabled: false,
        disabledReason: null,
        ungatedFeatures: features,
        gatedFeatureGroups: [],
      });
    });
  });

  it('gates premium only features and requires upgrade with free plan', async function () {
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

    await waitFor(() => {
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
    });
  });

  describe('FeatureList and IntegrationFeatures that distinguish free and premium', function () {
    const sub = SubscriptionFixture({organization, plan: 'am2_team'});
    SubscriptionStore.set(organization.slug, sub);

    // Fixtures do not add features based on plan. Manually add the
    // integrations-issue-basic feature for this organizations feature
    beforeEach(() => {
      organization.features = ['integrations-issue-basic'];
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-config/`,
        query: {tier: 'am2'},
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

    it('renders with the correct callback', async function () {
      const renderCallback = jest.fn(() => <Fragment />);

      render(
        <IntegrationFeatures {...{organization, features}}>
          {renderCallback}
        </IntegrationFeatures>
      );

      await waitFor(() => {
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
      });
    });

    it('renders feature list', async function () {
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

    it('renders no plan required for `non-plan-feature` feature', async function () {
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

    it('renders team plan required for `integrations-issue-basic` feature', async function () {
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

    it('renders biz plan required for `integrations-event-hooks` feature', async function () {
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

  describe('Gates features available ONLY on am2 plans', function () {
    const features = [
      {
        description: 'Link stack trace to source code.',
        featureGate: 'integrations-stacktrace-link',
      },
    ];

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-config/`,
        query: {tier: 'am2'},
        body: BillingConfigFixture(PlanTier.AM2),
      });
    });

    it('free features enabled when on any am2 plan', async function () {
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

    it('renders required performance plan am1 free features when on legacy plan', async function () {
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
