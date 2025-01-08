import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import UptimeAlertDetails from './details';

describe('UptimeAlertDetails', function () {
  const {organization, project, routerProps} = initializeOrg();

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=20&project=${project.id}&query=issue.category%3Auptime%20tags%5Buptime_rule%5D%3A1&statsPeriod=14d`,
      body: [],
    });
  });

  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/1/`,
      body: UptimeRuleFixture({name: 'Uptime Test Rule'}),
    });

    render(
      <UptimeAlertDetails
        {...routerProps}
        params={{...routerProps.params, uptimeRuleId: '1'}}
      />,
      {organization}
    );
    expect(await screen.findByText('Uptime Test Rule')).toBeInTheDocument();
  });

  it('shows a message for invalid uptime alert', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/2/`,
      statusCode: 404,
    });

    render(
      <UptimeAlertDetails
        {...routerProps}
        params={{...routerProps.params, uptimeRuleId: '2'}}
      />,
      {organization}
    );
    expect(
      await screen.findByText('The uptime alert rule you were looking for was not found.')
    ).toBeInTheDocument();
  });
});
