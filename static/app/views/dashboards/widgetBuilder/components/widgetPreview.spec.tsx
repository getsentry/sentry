import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetPreview} from 'sentry/views/dashboards/widgetBuilder/components/widgetPreview';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('WidgetPreview', () => {
  it('shows a message when a trace metrics widget has a blank equation', async () => {
    render(
      <WidgetPreview
        dashboard={{
          id: 'new',
          title: 'Test Dashboard',
          createdBy: undefined,
          dateCreated: '',
          widgets: [],
          projects: [],
          filters: {},
        }}
        dashboardFilters={{}}
      />,
      {
        organization: OrganizationFixture(),
        additionalWrapper: WidgetBuilderProvider,
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
              yAxis: ['equation|'],
            },
          },
        },
      }
    );

    expect(
      await screen.findByText('Enter an equation to preview results')
    ).toBeInTheDocument();
  });
});
