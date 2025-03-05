import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import TrialEndingModal from 'getsentry/components/trialEndingModal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('TrialEndingModal', function () {
  beforeEach(() => {
    setMockDate(new Date('2021-03-03'));

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      method: 'GET',
      body: [
        MemberFixture({
          email: 'admin@example.com',
        }),
      ],
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('shows request upgrade when user does not have billing permissions', function () {
    const org = OrganizationFixture({access: []});
    const sub = SubscriptionFixture({organization: org});
    SubscriptionStore.set(org.slug, sub);

    render(<TrialEndingModal closeModal={jest.fn()} organization={org} />);

    expect(screen.getByTestId('trial-ending-modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Request Upgrade')).toBeInTheDocument();
  });

  it('shows an upgrade button with billing permission', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org});
    SubscriptionStore.set(org.slug, sub);

    render(<TrialEndingModal closeModal={jest.fn()} organization={org} />);

    expect(screen.getByTestId('trial-ending-modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Upgrade Now')).toBeInTheDocument();
  });

  it('displays 3 days left', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, trialEnd: '2021-03-06'});
    SubscriptionStore.set(org.slug, sub);

    render(<TrialEndingModal closeModal={jest.fn()} organization={org} />);

    expect(screen.getByTestId('trial-ending-modal')).toBeInTheDocument();
    expect(screen.getByText('Trial Ends in 3 Days')).toBeInTheDocument();
    expect(screen.getByText(/Developer Plan in 3 days/)).toBeInTheDocument();
  });

  it('displays 1 day left', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, trialEnd: '2021-03-04'});
    SubscriptionStore.set(org.slug, sub);

    render(<TrialEndingModal closeModal={jest.fn()} organization={org} />);

    expect(screen.getByText('Trial Ends in 1 Day')).toBeInTheDocument();
    expect(screen.getByText(/Developer Plan in 1 day/)).toBeInTheDocument();
  });

  it('does not display negative days left', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, trialEnd: '2021-03-01'});
    SubscriptionStore.set(org.slug, sub);

    render(<TrialEndingModal closeModal={jest.fn()} organization={org} />);

    expect(screen.queryByTestId('trial-ending-modal')).not.toBeInTheDocument();
  });
});
