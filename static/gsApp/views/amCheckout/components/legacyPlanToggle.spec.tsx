import {OrganizationFixture} from 'sentry-fixture/organization';

import {PlanMigrationFixture} from 'getsentry-test/fixtures/planMigration';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {CohortId} from 'getsentry/types';
import LegacyPlanToggle from 'getsentry/views/amCheckout/components/legacyPlanToggle';

describe('LegacyPlanToggle', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    SubscriptionStore.set(organization.slug, {});
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      body: [],
    });
  });

  describe('AMCheckout', () => {
    it('renders for am1 paid plan', async () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am1',
        plan: 'am1_team',
      });
      SubscriptionStore.set(org.slug, subscription);

      render(
        <LegacyPlanToggle organization={org} checkoutTier="am2" onClick={jest.fn()} />
      );
      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(
        await screen.findByRole('button', {name: 'Show previous plans'})
      ).toBeInTheDocument();
    });

    it('renders for am1 paid plan in previous checkout', async () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am1',
        plan: 'am1_team',
      });
      SubscriptionStore.set(org.slug, subscription);

      render(
        <LegacyPlanToggle organization={org} checkoutTier="am1" onClick={jest.fn()} />
      );
      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(screen.getByRole('button', {name: 'Show latest plans'})).toBeInTheDocument();
    });

    it('does not render for am1 free plan', async () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am1',
        plan: 'am1_f',
      });
      SubscriptionStore.set(org.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle organization={org} checkoutTier="am2" onClick={jest.fn()} />
      );

      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render for am2 free plan', async () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am2',
        plan: 'am2_f',
      });
      SubscriptionStore.set(org.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle organization={org} checkoutTier="am2" onClick={jest.fn()} />
      );

      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));
      expect(container).toBeEmptyDOMElement();
    });

    it('does not render for am2 paid plan', async () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am2',
        plan: 'am2_team',
      });
      SubscriptionStore.set(org.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle organization={org} checkoutTier="am2" onClick={jest.fn()} />
      );

      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));
      expect(container).toBeEmptyDOMElement();
    });

    it('does not render for am3 free plan', () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am3',
        plan: 'am3_f',
      });
      SubscriptionStore.set(org.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle organization={org} checkoutTier="am3" onClick={jest.fn()} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render for am3 paid plan', () => {
      const org = OrganizationFixture();
      const subscription = SubscriptionFixture({
        organization: org,
        planTier: 'am3',
        plan: 'am3_team',
      });
      SubscriptionStore.set(org.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle organization={org} checkoutTier="am3" onClick={jest.fn()} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render with mm2 paid plan', async () => {
      const subscription = SubscriptionFixture({
        organization,
        planTier: 'mm2',
        plan: 'mm2_b_100k',
      });
      SubscriptionStore.set(organization.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle
          organization={organization}
          checkoutTier="am2"
          onClick={jest.fn()}
        />
      );

      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render with mm2 paid plan and pending plan migration', async () => {
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
        body: PlanMigrationFixture({cohortId: CohortId.SECOND}),
      });

      const subscription = SubscriptionFixture({
        organization,
        planTier: 'mm2',
        plan: 'mm2_b_100k',
      });
      SubscriptionStore.set(organization.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle
          organization={organization}
          checkoutTier="am2"
          onClick={jest.fn()}
        />
      );

      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render with mm2 free plan', async () => {
      const subscription = SubscriptionFixture({
        organization,
        planTier: 'mm2',
        plan: 'mm2_f',
      });
      SubscriptionStore.set(organization.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle
          organization={organization}
          checkoutTier="am2"
          onClick={jest.fn()}
        />
      );
      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render with mm1 free plan', async () => {
      const subscription = SubscriptionFixture({
        organization,
        planTier: 'mm1',
        plan: 'f1',
      });
      SubscriptionStore.set(organization.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle
          organization={organization}
          checkoutTier="am2"
          onClick={jest.fn()}
        />
      );
      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render with mm1 paid plan', async () => {
      const subscription = SubscriptionFixture({
        organization,
        planTier: 'mm1',
        plan: 'm1',
      });
      SubscriptionStore.set(organization.slug, subscription);

      const {container} = render(
        <LegacyPlanToggle
          organization={organization}
          checkoutTier="am2"
          onClick={jest.fn()}
        />
      );
      await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

      expect(container).toBeEmptyDOMElement();
    });
  });
});
