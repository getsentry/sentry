import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import Notifications from 'getsentry/views/subscriptionPage/notifications';

describe('Subscription > Notifications', () => {
  const organization = OrganizationFixture({
    slug: 'chum-bucket',
  });
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/spend-notifications/`,
      method: 'GET',
      body: {reservedPercent: [90], perProductOndemandPercent: [80, 50]},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    organization.access = ['org:billing'];
    organization.features = ['spend-visibility-notifications'];
    subscription.planDetails.allowOnDemand = false;
    SubscriptionStore.set(organization.slug, subscription);
  });

  it('renders', async () => {
    render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );

    expect(await screen.findByText('Manage Spend Notifications')).toBeInTheDocument();
  });

  it('redirects without flag', () => {
    organization.features = [];
    const {router} = render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );

    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: '/settings/chum-bucket/billing/overview/',
        query: {},
      })
    );
  });

  it('renders an error for non-billing users', async () => {
    organization.access = [];
    render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );
    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Configure the thresholds for your organization's spend notifications."
      )
    ).not.toBeInTheDocument();
  });

  it('renders On-Demand Consumption if on-demand is enabled', async () => {
    subscription.planDetails.allowOnDemand = true;
    SubscriptionStore.set(organization.slug, subscription);

    render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );

    expect(await screen.findByText('Subscription consumption')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('On-Demand consumption')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('disables save button if there are no thresholds', async () => {
    subscription.planDetails.allowOnDemand = true;
    SubscriptionStore.set(organization.slug, subscription);

    render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    const textbox = screen.getByRole('textbox', {
      name: 'Update subscription consumption spend notification thresholds',
    });
    await userEvent.click(textbox);
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '50%'}));
    expect(screen.getByRole('button', {name: 'Save changes'})).toBeEnabled();

    // userEvent.clear doesn't work because of the way the custom select component works
    await userEvent.type(textbox, '{backspace}');
    await userEvent.type(textbox, '{backspace}');
    await userEvent.type(textbox, '{backspace}');
    expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
  });

  it('reverts to saved thresholds on reset', async () => {
    render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    const textbox = screen.getByRole('textbox', {
      name: 'Update subscription consumption spend notification thresholds',
    });

    await userEvent.click(textbox);
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '70%'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '50%'}));
    expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled();
    await userEvent.click(document.body); // click outside to close the dropdown
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();
  });

  it('calls api with correct args', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/spend-notifications/`,
      method: 'POST',
      body: {reservedPercent: [90, 60], perProductOndemandPercent: [80, 50]},
    });

    render(
      <Notifications {...RouteComponentPropsFixture()} subscription={subscription} />,
      {organization}
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('textbox', {
        name: 'Update subscription consumption spend notification thresholds',
      })
    );
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '60%'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    expect(postMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/spend-notifications/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          reservedPercent: [90, 60],
          perProductOndemandPercent: [80, 50],
        },
      })
    );
  });
});
