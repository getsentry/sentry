import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';
import {UptimeSummaryFixture} from 'sentry-fixture/uptimeSummary';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import UptimeAlertDetails from './details';

describe('UptimeAlertDetails', () => {
  const {organization, project, routerProps} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/?limit=1&project=2&query=issue.type%3Auptime_domain_failure%20title%3A%22Downtime%20detected%20for%20https%3A%2F%2Fsentry.io%2F%22`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/1/checks/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime-summary/',
      body: {
        '1': UptimeSummaryFixture(),
      },
    });
  });

  it('renders', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/1/`,
      body: UptimeRuleFixture({name: 'Uptime Test Rule'}),
    });

    render(
      <UptimeAlertDetails
        {...routerProps}
        params={{...routerProps.params, detectorId: '1'}}
      />,
      {organization}
    );
    expect(await screen.findByText('Uptime Test Rule')).toBeInTheDocument();
  });

  it('shows a message for invalid uptime alert', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/2/`,
      statusCode: 404,
    });

    render(
      <UptimeAlertDetails
        {...routerProps}
        params={{...routerProps.params, detectorId: '2'}}
      />,
      {organization}
    );
    expect(
      await screen.findByText('The uptime alert rule you were looking for was not found.')
    ).toBeInTheDocument();
  });

  it('disables and enables the rule', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/2/`,
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/1/`,
      body: UptimeRuleFixture({name: 'Uptime Test Rule'}),
    });

    render(
      <UptimeAlertDetails
        {...routerProps}
        params={{...routerProps.params, detectorId: '1'}}
      />,
      {organization}
    );
    await screen.findByText('Uptime Test Rule');

    const disableMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/1/`,
      method: 'PUT',
      body: UptimeRuleFixture({name: 'Uptime Test Rule', status: 'disabled'}),
    });

    const disableButtons = await screen.findAllByRole('button', {
      name: 'Disable this uptime rule and stop performing checks',
    });
    await userEvent.click(disableButtons[0]!);

    expect(disableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {status: 'disabled'}})
    );

    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/1/`,
      method: 'PUT',
      body: UptimeRuleFixture({name: 'Uptime Test Rule', status: 'active'}),
    });

    // Button now re-enables the monitor
    const enabledButtons = await screen.findAllByRole('button', {
      name: 'Enable this uptime rule',
    });
    await userEvent.click(enabledButtons[0]!);

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {status: 'active'}})
    );
  });
});
