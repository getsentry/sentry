import {browserHistory} from 'react-router';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import ViewEditDashboard from 'sentry/views/dashboards/view';

describe('Dashboards > ViewEditDashboard', function () {
  const initialData = initializeOrg();

  it('removes widget params from url and preserves selection params', function () {
    const location = {
      pathname: '/',
      query: {
        environment: 'canary',
        period: '7d',
        project: '11111',
        start: null,
        end: null,
        utc: null,
        displayType: 'line',
        interval: '5m',
        queryConditions: '',
        queryFields: 'count()',
        queryNames: '',
        queryOrderby: '',
        title: 'test',
        statsPeriod: '7d',
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/1/visit/`,
      statusCode: 200,
      method: 'POST',
    });

    render(
      <ViewEditDashboard
        location={LocationFixture(location)}
        organization={initialData.organization}
        router={initialData.router}
        params={{
          orgId: initialData.organization.slug,
          dashboardId: '1',
        }}
        route={{}}
        routes={[]}
        routeParams={{}}
      >
        {() => undefined}
      </ViewEditDashboard>
    );

    expect(browserHistory.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/',
        query: {
          end: null,
          environment: 'canary',
          period: '7d',
          project: '11111',
          start: null,
          statsPeriod: '7d',
          utc: null,
        },
      })
    );
  });
});
