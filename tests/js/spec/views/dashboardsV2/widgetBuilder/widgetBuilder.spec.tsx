import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import {DisplayType, Widget} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';
import {DataSet} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
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

    mountWithTheme(
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={TestStubs.Dashboard()}
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

  it('data set not found', function () {
    const {organization, router, routerContext} = initializeOrg({
      ...initializeOrg(),
      organization: {
        features: ['new-widget-builder-experience', 'dashboards-edit'],
      },
    });

    mountWithTheme(
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={TestStubs.Dashboard()}
        onSave={jest.fn()}
        organization={organization}
        params={{orgId: organization.slug}}
      />,
      {
        context: routerContext,
      }
    );

    expect(screen.getByText('Data set not found.')).toBeInTheDocument();
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
            dataSet: DataSet.EVENTS,
          },
        },
      },
    });

    const widget: Widget = {
      displayType: DisplayType.AREA,
      interval: '1d',
      queries: [],
      title: 'Transactions',
      id: '1',
    };

    mountWithTheme(
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={TestStubs.Dashboard([])}
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
            dataSet: DataSet.EVENTS,
          },
        },
      },
    });

    mountWithTheme(
      <TestComponent
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={TestStubs.Dashboard()}
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
      '/organizations/org-slug/dashboards/new/?'
    );
    expect(screen.getByText('Widget Builder')).toBeInTheDocument();

    // Header - Widget Title
    expect(
      screen.getByRole('heading', {name: 'Custom Area Chart Widget'})
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
