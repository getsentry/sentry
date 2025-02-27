import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import UpsellProvider from 'getsentry/components/upsellProvider';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

jest.mock('getsentry/actionCreators/modal');

const createRenderer = () => {
  return jest.fn(({onClick, defaultButtonText}) => (
    <div data-test-id="test-render" onClick={onClick}>
      {defaultButtonText}
    </div>
  ));
};

describe('UpsellProvider', function () {
  let org!: Organization;
  let sub!: Subscription;
  let router: any;

  const populateOrg = (orgProps = {}, subProps = {}) => {
    ({router, organization: org} = initializeOrg({organization: orgProps}));
    sub = SubscriptionFixture({organization: org, ...subProps});
    SubscriptionStore.set(org.slug, sub);

    // might re-load the org/sub after a trial starts
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/`,
      body: org,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture()],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TeamFixture()],
    });

    MockApiClient.addMockResponse({
      url: `/subscriptions/${org.slug}/`,
      body: sub,
    });

    return org;
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    (browserHistory.push as jest.Mock).mockClear();
  });

  it('with billing scope starts a trial if available', async function () {
    populateOrg({access: ['org:billing']});
    const renderer = createRenderer();

    const handleTrialStarted = jest.fn();

    render(
      <UpsellProvider
        source="test-abc"
        triggerMemberRequests
        onTrialStarted={handleTrialStarted}
      >
        {renderer}
      </UpsellProvider>,
      {router, organization: org}
    );

    expect(screen.getByText('Start Trial')).toBeInTheDocument();
    expect(renderer).toHaveBeenCalled();

    // Setup to start subscription
    const startTrialMock = MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/`,
      method: 'PUT',
    });

    await userEvent.click(screen.getByTestId('test-render'));
    await tick();

    expect(startTrialMock).toHaveBeenCalled();
    expect(handleTrialStarted).toHaveBeenCalled();
  });

  it('with billing scope redirect to sub page', async function () {
    populateOrg({access: ['org:billing']}, {canTrial: false});
    const renderer = createRenderer();

    render(<UpsellProvider source="test-abc">{renderer}</UpsellProvider>, {
      router,
      organization: org,
    });

    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
    expect(renderer).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('test-render'));

    expect(browserHistory.push).toHaveBeenCalledWith(
      `/settings/${org.slug}/billing/checkout/?referrer=upsell-test-abc`
    );
  });

  it('no billing scope opens modal', async function () {
    populateOrg();
    const renderer = createRenderer();

    render(<UpsellProvider source="test-abc">{renderer}</UpsellProvider>, {
      organization: org,
    });
    expect(screen.getByText('Start Trial')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('test-render'));

    expect(openUpsellModal).toHaveBeenCalled();
  });

  it('request trial with triggerMemberRequests', async function () {
    populateOrg();
    const renderer = createRenderer();

    const requestTrialMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/trial-request/`,
      method: 'POST',
    });

    render(
      <UpsellProvider source="test-abc" triggerMemberRequests>
        {renderer}
      </UpsellProvider>,
      {router, organization: org}
    );
    expect(screen.getByText('Request Trial')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('test-render'));
    expect(requestTrialMock).toHaveBeenCalled();
  });

  it('request plan upgrade with triggerMemberRequests', async function () {
    populateOrg(undefined, {canTrial: false});
    const renderer = createRenderer();

    const requestTrialMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/plan-upgrade-request/`,
      method: 'POST',
    });

    render(
      <UpsellProvider source="test-abc" triggerMemberRequests>
        {renderer}
      </UpsellProvider>,
      {router, organization: org}
    );

    expect(screen.getByText('Request Upgrade')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('test-render'));
    expect(requestTrialMock).toHaveBeenCalled();
  });

  it('opens modal with showConfirmation', async function () {
    populateOrg(
      {
        access: ['org:billing'],
      },
      {
        canTrial: true,
      }
    );

    const renderer = createRenderer();
    const handleTrialStarted = jest.fn();
    const startTrialMock = MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/`,
      method: 'PUT',
    });

    const {waitForModalToHide} = renderGlobalModal();
    render(
      <UpsellProvider
        source="test-abc"
        showConfirmation
        onTrialStarted={handleTrialStarted}
      >
        {renderer}
      </UpsellProvider>,
      {router, organization: org}
    );
    await userEvent.click(screen.getByTestId('test-render'));
    await tick();

    expect(screen.getByTestId('confirm-content')).toBeInTheDocument();
    expect(handleTrialStarted).not.toHaveBeenCalled();
    expect(startTrialMock).not.toHaveBeenCalled();

    const button = screen.getByRole('button', {name: 'Start Trial'});
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    await waitForModalToHide();

    expect(handleTrialStarted).toHaveBeenCalled();
    expect(startTrialMock).toHaveBeenCalled();
  });

  it('render nothing if non-self serve for non-billing with triggering member requests', function () {
    populateOrg({}, {canSelfServe: false});
    const renderer = createRenderer();

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/trial-request/`,
      method: 'POST',
    });

    const {container} = render(
      <UpsellProvider source="test-abc" triggerMemberRequests>
        {renderer}
      </UpsellProvider>,
      {router, organization: org}
    );
    expect(container).toBeEmptyDOMElement();
  });
});
