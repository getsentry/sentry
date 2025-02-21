import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import Notifications from 'getsentry/views/subscriptionPage/notifications';

describe('Subscription > Notifications', function () {
  const organization = OrganizationFixture({
    slug: 'chum-bucket',
  });
  const subscription = SubscriptionFixture({organization});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/spend-notifications/`,
      method: 'GET',
      body: {reservedPercent: [90], perProductOndemandPercent: [80, 50]},
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
    subscription.planDetails.allowOnDemand = false;
    SubscriptionStore.set(organization.slug, subscription);
  });

  it('renders', async function () {
    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(
      await screen.findByText(
        "Configure the thresholds for your organization's spend notifications."
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Subscription Consumption')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: '90%'}));
    // 90% is selected so it is not one of the options
    const expectedOptions = ['80%', '70%', '60%', '50%', '40%', '30%', '20%', '10%'];
    const actualOptions = screen.getAllByTestId('menu-list-item-label');
    expect(actualOptions).toHaveLength(expectedOptions.length);
    actualOptions.forEach((element, idx) => {
      expect(element).toHaveTextContent(expectedOptions[idx]!);
    });
    expect(screen.queryByText('On-Demand Consumption')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeDisabled();
  });

  it('renders an error for non-billing users', async function () {
    organization.access = [];
    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );
    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Configure the thresholds for your organization's spend notifications."
      )
    ).not.toBeInTheDocument();
  });

  it('renders On-Demand Consumption if on-demand is enabled', async function () {
    subscription.planDetails.allowOnDemand = true;
    SubscriptionStore.set(organization.slug, subscription);

    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(
      await screen.findByText(
        "Configure the thresholds for your organization's spend notifications."
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Subscription Consumption')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('On-Demand Consumption')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('enables delete button if there is more than two thresholds for a section', async function () {
    subscription.planDetails.allowOnDemand = true;
    SubscriptionStore.set(organization.slug, subscription);

    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Remove notification threshold',
    });
    expect(deleteButtons).toHaveLength(3);
    expect(deleteButtons[0]).toBeDisabled();

    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(deleteButtons[1]).toBeEnabled();
    expect(deleteButtons[2]).toBeEnabled();
  });

  it('allows 9 thresholds per section max', async function () {
    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    const clickOptions = {skipHover: true, delay: null};
    for (const percentage of ['80%', '70%', '60%', '50%', '40%', '30%', '20%', '10%']) {
      await userEvent.click(
        screen.getByRole('button', {name: 'Add threshold'}),
        clickOptions
      );
      await userEvent.click(screen.getByRole('option', {name: percentage}), clickOptions);
      await userEvent.click(
        screen.getByRole('button', {name: 'Add notification threshold'}),
        clickOptions
      );
      expect(screen.getByText(percentage)).toBeInTheDocument();
    }

    expect(screen.queryByText('Add threshold')).not.toBeInTheDocument();
  });

  it('reverts to saved thresholds on reset', async function () {
    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Add threshold'}));
    await userEvent.click(screen.getByRole('option', {name: '70%'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Add notification threshold'})
    );
    expect(screen.getByText('70%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add threshold'}));
    await userEvent.click(screen.getByRole('option', {name: '50%'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Add notification threshold'})
    );
    expect(screen.getByText('50%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('calls api with correct args', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/spend-notifications/`,
      method: 'POST',
      body: {reservedPercent: [90, 60], perProductOndemandPercent: [80, 50]},
    });

    render(
      <Notifications
        {...RouteComponentPropsFixture()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(await screen.findByText('90%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Add threshold'}));
    await userEvent.click(screen.getByRole('option', {name: '60%'}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Add notification threshold'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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
