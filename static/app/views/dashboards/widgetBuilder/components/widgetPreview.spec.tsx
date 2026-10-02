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

  const renderOptions = {
    organization: OrganizationFixture(),
    additionalWrapper: WidgetBuilderProvider,
    initialRouterConfig: {
      location: {pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME},
    },
  };

  function ExampleWidgetPreview({
    previewStatus,
  }: {
    previewStatus: Parameters<typeof WidgetPreview>[0]['previewStatus'];
  }) {
    return (
      <WidgetPreview
        dashboard={dashboard}
        dashboardFilters={{}}
        previewStatus={previewStatus}
      />
    );
  }

  it('renders a loading state when the preview status is loading', () => {
    render(<ExampleWidgetPreview previewStatus={{status: 'loading'}} />, renderOptions);
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders the error message when the preview status is invalid', () => {
    render(
      <ExampleWidgetPreview
        previewStatus={{status: 'invalid', message: 'This widget is broken.'}}
      />,
      renderOptions
    );
    expect(screen.getByText('This widget is broken.')).toBeInTheDocument();
  });
});
