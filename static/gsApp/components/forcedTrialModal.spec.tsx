import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ForcedTrialModal from 'getsentry/components/forcedTrialModal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

const slug = 'my-org';

describe('ForcedTrialModal', function () {
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
      trialEnd: now.add(14, 'day').toString(),
      ...subParams,
    });
    SubscriptionStore.set(org.slug, sub);
  };
  describe('member limit', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${slug}/integrations/?includeConfig=0`,
        method: 'GET',
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
    it('shows request upgrade when user does not have billing permissions', function () {
      populateOrgAndSub({access: []});

      render(<ForcedTrialModal closeModal={jest.fn()} organization={org} />);
      expect(screen.getByLabelText('Request Upgrade')).toBeInTheDocument();
      expect(
        screen.getByText('You may lose access to Sentry in 14 days')
      ).toBeInTheDocument();
    });
    it('shows upgrade now when user has billing permissions', function () {
      populateOrgAndSub();

      render(<ForcedTrialModal closeModal={jest.fn()} organization={org} />);
      expect(screen.getByLabelText('Upgrade')).toBeInTheDocument();
      expect(
        screen.getByText('Members may lose access to Sentry in 14 days')
      ).toBeInTheDocument();
    });
  });
  describe('disallowed integration', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${slug}/integrations/?includeConfig=0`,
        method: 'GET',
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
    it('shows upgrade button if has slack', function () {
      populateOrgAndSub();

      render(<ForcedTrialModal closeModal={jest.fn()} organization={org} />);
      expect(screen.getByLabelText('Upgrade')).toBeInTheDocument();
      expect(
        screen.getByText('Your Slack integration will stop working in 14 days')
      ).toBeInTheDocument();
    });
  });
});
