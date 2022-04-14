import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {Organization} from 'sentry/types';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {DashboardWidgetSource} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder from 'sentry/views/dashboardsV2/widgetBuilder';

jest.unmock('lodash/debounce');

function mockRequests(orgSlug: Organization['slug']) {
  const eventsv2Mock = MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/eventsv2/`,
    method: 'GET',
    statusCode: 200,
    body: {
      meta: {},
      data: [],
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/tags/',
    method: 'GET',
    body: TestStubs.Tags(),
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    method: 'GET',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/metrics/meta/`,
    body: [
      {
        name: SessionMetric.SESSION,
        type: 'counter',
        operations: ['sum'],
        unit: null,
      },
    ],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/metrics/tags/`,
    body: [],
  });

  return {eventsv2Mock};
}

describe('VisualizationStep', function () {
  const {organization, router, routerContext} = initializeOrg({
    ...initializeOrg(),
    organization: {
      features: [
        'new-widget-builder-experience',
        'dashboards-edit',
        'global-views',
        'new-widget-builder-experience-design',
      ],
    },
    router: {
      location: {
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
        },
      },
    },
  });

  it('debounce works as expected and requests are not triggered often', async function () {
    const {eventsv2Mock} = mockRequests(organization.slug);

    jest.useFakeTimers();

    render(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={{
          id: 'new',
          title: 'Dashboard',
          createdBy: undefined,
          dateCreated: '2020-01-01T00:00:00.000Z',
          widgets: [],
        }}
        onSave={jest.fn()}
        params={{
          orgId: organization.slug,
          dashboardId: 'new',
        }}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    await screen.findByText('Table');

    userEvent.type(screen.getByPlaceholderText('Alias'), 'First Alias{enter}');
    act(() => {
      jest.advanceTimersByTime(DEFAULT_DEBOUNCE_DURATION + 1);
    });

    await waitFor(() => expect(eventsv2Mock).toHaveBeenCalledTimes(2));
  });
});
