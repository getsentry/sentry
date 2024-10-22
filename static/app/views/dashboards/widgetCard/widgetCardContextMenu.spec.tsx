import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {performanceScoreTooltip} from 'sentry/views/dashboards/utils';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';

describe('WidgetCardContextMenu', () => {
  it('displays performance_score tooltip when widget uses performance_score', async () => {
    render(
      <DashboardsMEPProvider>
        <WidgetCardContextMenu
          location={LocationFixture()}
          organization={OrganizationFixture({
            features: ['discover-basic'],
          })}
          router={RouterFixture()}
          selection={PageFiltersFixture()}
          widget={{
            displayType: DisplayType.AREA,
            interval: '',
            queries: [
              {
                name: '',
                fields: ['performance_score(measurements.score.total)'],
                aggregates: ['performance_score(measurements.score.total)'],
                conditions: '',
                columns: [],
                orderby: '',
              },
            ],
            title: '',
            datasetSource: undefined,
            description: undefined,
            id: undefined,
            layout: undefined,
            limit: undefined,
            tempId: undefined,
            thresholds: undefined,
            widgetType: WidgetType.TRANSACTIONS,
          }}
          widgetLimitReached={false}
          showContextMenu
        />
      </DashboardsMEPProvider>
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));

    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('Open in Discover'));
    expect(await screen.findByText(performanceScoreTooltip)).toBeInTheDocument();
  });
});
