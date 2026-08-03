import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {WidgetPreview} from 'sentry/views/dashboards/widgetBuilder/components/widgetPreview';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('WidgetPreview', () => {
  const dashboard: DashboardDetails = {
    id: 'new',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '',
    widgets: [],
    projects: [],
    filters: {},
  };

  function renderPreview(
    previewStatus: Parameters<typeof WidgetPreview>[0]['previewStatus']
  ) {
    render(
      <WidgetPreview
        dashboard={dashboard}
        dashboardFilters={{}}
        previewStatus={previewStatus}
      />,
      {
        organization: OrganizationFixture(),
        additionalWrapper: WidgetBuilderProvider,
        initialRouterConfig: {
          location: {pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME},
        },
      }
    );
  }

  it('renders a loading state when the preview status is loading', () => {
    renderPreview({status: 'loading'});
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders the error message when the preview status is invalid', () => {
    renderPreview({status: 'invalid', message: 'This widget is broken.'});
    expect(screen.getByText('This widget is broken.')).toBeInTheDocument();
  });
});
