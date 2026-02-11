import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ForcedTrialModal from 'getsentry/components/forcedTrialModal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

const slug = 'my-org';

describe('ForcedTrialModal', () => {
  let org: any, sub: any;
  const populateOrgAndSub = (orgParams = {}, subParams = {}) => {
    const now = moment();
    org = OrganizationFixture({
      slug,
      access: ['org:billing'],
      ...orgParams,
    });
    sub = SubscriptionFixture({
      organization: org,
      trialEnd: now.add(14, 'day').toISOString(),
      ...subParams,
    });
    SubscriptionStore.set(org.slug, sub);
  };
  describe('member limit', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${slug}/integrations/`,
        method: 'GET',
        query: {
          includeConfig: 0,
        },
        body: [
          {
            provider: {
              slug: 'msteams',
              name: 'Microsoft Teams',
            },
          },
        ],
      });
    });
    it('shows request upgrade when user does not have billing permissions', async () => {
      populateOrgAndSub({access: []});

      render(<ForcedTrialModal closeModal={jest.fn()} organization={org} />);
      expect(await screen.findByLabelText('Request Upgrade')).toBeInTheDocument();
      expect(
        screen.getByText('You may lose access to Sentry in 14 days')
      ).toBeInTheDocument();
    });
    it('shows upgrade now when user has billing permissions', async () => {
      populateOrgAndSub();

      render(<ForcedTrialModal closeModal={jest.fn()} organization={org} />);
      expect(await screen.findByLabelText('Upgrade')).toBeInTheDocument();
      expect(
        screen.getByText('Members may lose access to Sentry in 14 days')
      ).toBeInTheDocument();
    });
  });
  describe('disallowed integration', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${slug}/integrations/`,
        method: 'GET',
        query: {
          includeConfig: 0,
        },
        body: [
          {
            provider: {
              slug: 'slack',
              name: 'Slack',
            },
          },
        ],
      });
    });
    it('shows upgrade button if has slack', async () => {
      populateOrgAndSub();

      render(<ForcedTrialModal closeModal={jest.fn()} organization={org} />);
      expect(await screen.findByLabelText('Upgrade')).toBeInTheDocument();
      expect(
        screen.getByText('Your Slack integration will stop working in 14 days')
      ).toBeInTheDocument();
    });
  });
});
