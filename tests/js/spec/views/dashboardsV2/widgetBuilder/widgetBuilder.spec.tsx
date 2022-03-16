import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';

// Mock World Map because setState inside componentDidMount is
// throwing UnhandledPromiseRejection
jest.mock('sentry/components/charts/worldMapChart');

const defaultOrgFeatures = [
  'new-widget-builder-experience',
  'dashboards-edit',
  'global-views',
];

function renderTestComponent({
  widget,
  dashboard,
  query,
  orgFeatures,
  onSave,
  params,
}: {
  dashboard?: WidgetBuilderProps['dashboard'];
  onSave?: WidgetBuilderProps['onSave'];
  orgFeatures?: string[];
  params?: WidgetBuilderProps['params'];
  query?: Record<string, any>;
  widget?: WidgetBuilderProps['widget'];
} = {}) {
  const {organization, router, routerContext} = initializeOrg({
    ...initializeOrg(),
    organization: {
      features: orgFeatures ?? defaultOrgFeatures,
    },
    router: {
      location: {
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          ...query,
        },
      },
    },
  });

  render(
    <WidgetBuilder
      route={{}}
      router={router}
      routes={router.routes}
      routeParams={router.params}
      location={router.location}
      dashboard={
        dashboard ?? {
          id: '1',
          title: 'Dashboard',
          createdBy: undefined,
          dateCreated: '2020-01-01T00:00:00.000Z',
          widgets: [],
        }
      }
      onSave={onSave ?? jest.fn()}
      widget={widget}
      params={{
        orgId: organization.slug,
        widgetIndex: widget ? 0 : undefined,
        ...params,
      }}
    />,
    {
      context: routerContext,
      organization,
    }
  );

  return {router};
}

describe('WidgetBuilder', function () {
  const untitledDashboard: DashboardDetails = {
    id: '1',
    title: 'Untitled Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
  };

  const testDashboard: DashboardDetails = {
    id: '2',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
  };

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {...untitledDashboard, widgetDisplay: [DisplayType.TABLE]},
        {...testDashboard, widgetDisplay: [DisplayType.AREA]},
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      method: 'GET',
      statusCode: 200,
      body: {
        meta: {},
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/event.type/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: {data: [], meta: {}},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('group by field', function () {
    it('allows adding up to GROUP_BY_LIMIT fields', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');

      for (let i = 0; i < 19; i++) {
        userEvent.click(screen.getByText('Add Group'));
      }

      expect(await screen.findAllByText('Select group')).toHaveLength(20);
      expect(screen.queryByText('Add Group')).not.toBeInTheDocument();
    });

    it('allows deleting groups until there is one left', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');
      userEvent.click(screen.getByText('Add Group'));
      expect(screen.getAllByLabelText('Remove group')).toHaveLength(2);

      userEvent.click(screen.getAllByLabelText('Remove group')[1]);
      expect(screen.queryByLabelText('Remove group')).not.toBeInTheDocument();
    });

    it('should randomly fail', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });
    });
  });
});
