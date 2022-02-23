import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder from 'sentry/views/dashboardsV2/widgetBuilder';

describe('WidgetBuilder', function () {
  it('no feature access', function () {
    const {organization, router, routerContext} = initializeOrg();

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [],
    };

    mountWithTheme(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={dashboard}
        onSave={jest.fn()}
        params={{orgId: organization.slug}}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('widget not found', function () {
    const {organization, router, routerContext} = initializeOrg({
      ...initializeOrg(),
      organization: {
        features: ['new-widget-builder-experience', 'dashboards-edit'],
      },
      router: {
        location: {
          query: {
            source: DashboardWidgetSource.DASHBOARDS,
          },
        },
      },
    });

    const widget: Widget = {
      displayType: DisplayType.AREA,
      interval: '1d',
      queries: [
        {
          name: 'Known Users',
          fields: [],
          conditions: '',
          orderby: '-time',
        },
        {
          name: 'Anonymous Users',
          fields: [],
          conditions: '',
          orderby: '-time',
        },
      ],
      title: 'Transactions',
      id: '1',
    };

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [],
    };

    mountWithTheme(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={dashboard}
        onSave={jest.fn()}
        widget={widget}
        params={{orgId: organization.slug, widgetId: Number(widget.id)}}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    expect(
      screen.getByText('The widget you want to edit was not found.')
    ).toBeInTheDocument();
  });

  it('renders', async function () {
    const {organization, router, routerContext} = initializeOrg({
      ...initializeOrg(),
      organization: {
        features: ['new-widget-builder-experience', 'dashboards-edit', 'global-views'],
      },
      router: {
        location: {
          query: {
            source: DashboardWidgetSource.DASHBOARDS,
          },
        },
      },
    });

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [],
    };

    mountWithTheme(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={dashboard}
        onSave={jest.fn()}
        params={{orgId: organization.slug}}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    // Header - Breadcrumbs
    expect(await screen.findByRole('link', {name: 'Dashboards'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/'
    );
    expect(screen.getByRole('link', {name: 'Dashboard'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/?source=dashboards'
    );
    expect(screen.getByText('Widget Builder')).toBeInTheDocument();

    // Header - Widget Title
    expect(screen.getByRole('heading', {name: 'Custom Widget'})).toBeInTheDocument();

    // Header - Actions
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Widget'})).toBeInTheDocument();

    // Content - Step 1
    expect(
      screen.getByRole('heading', {name: 'Choose your data set'})
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Select All Events (Errors and Transactions)')
    ).toBeChecked();

    // Content - Step 2
    expect(
      screen.getByRole('heading', {name: 'Choose your visualization'})
    ).toBeInTheDocument();

    // Content - Step 3
    expect(screen.getByRole('heading', {name: 'Columns'})).toBeInTheDocument();

    // Content - Step 4
    expect(screen.getByRole('heading', {name: 'Query'})).toBeInTheDocument();

    // Content - Step 5
    expect(screen.getByRole('heading', {name: 'Sort by'})).toBeInTheDocument();
  });
});
