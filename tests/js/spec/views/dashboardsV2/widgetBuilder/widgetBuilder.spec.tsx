import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';
import {OrganizationContext} from 'sentry/views/organizationContext';

function TestComponent({
  organization,
  ...props
}: WidgetBuilderProps & {organization: Organization}) {
  return (
    <OrganizationContext.Provider value={organization}>
      <WidgetBuilder {...props} />
    </OrganizationContext.Provider>
  );
}

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
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={dashboard}
        onSave={jest.fn()}
        organization={organization}
        params={{orgId: organization.slug}}
      />,
      {
        context: routerContext,
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
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={dashboard}
        onSave={jest.fn()}
        widget={widget}
        organization={organization}
        params={{orgId: organization.slug, widgetId: Number(widget.id)}}
      />,
      {
        context: routerContext,
      }
    );

    expect(screen.getByText('Widget not found.')).toBeInTheDocument();
  });

  it('renders', function () {
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

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [],
    };

    mountWithTheme(
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={dashboard}
        onSave={jest.fn()}
        organization={organization}
        params={{orgId: organization.slug}}
      />,
      {
        context: routerContext,
      }
    );

    // Header - Breadcrumbs
    expect(screen.getByRole('link', {name: 'Dashboards'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/'
    );
    expect(screen.getByRole('link', {name: 'Dashboard'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/?source=dashboards'
    );
    expect(screen.getByText('Widget Builder')).toBeInTheDocument();

    // Header - Widget Title
    expect(
      screen.getByRole('heading', {name: 'Custom Table Widget'})
    ).toBeInTheDocument();

    // Header - Actions
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Widget'})).toBeInTheDocument();

    // Content - Step 1
    expect(
      screen.getByRole('heading', {name: 'Choose your data set'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('events')).toBeChecked();

    // Content - Step 2
    expect(
      screen.getByRole('heading', {name: 'Choose your visualization'})
    ).toBeInTheDocument();

    // Content - Step 3
    expect(screen.getByRole('heading', {name: 'Choose your y-axis'})).toBeInTheDocument();

    // Content - Step 4
    expect(
      screen.getByRole('heading', {name: 'Filter your results'})
    ).toBeInTheDocument();

    // Content - Step 5
    expect(screen.getByRole('heading', {name: 'Group your results'})).toBeInTheDocument();
  });
});
