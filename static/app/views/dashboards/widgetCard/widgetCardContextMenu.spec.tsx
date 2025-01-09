import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {performanceScoreTooltip} from 'sentry/views/dashboards/utils';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';

describe('WidgetCardContextMenu', () => {
  it('displays performance_score tooltip when widget uses performance_score', async () => {
    render(
      <MEPSettingProvider>
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
      </MEPSettingProvider>
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));

    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('Open in Discover'));
    expect(await screen.findByText(performanceScoreTooltip)).toBeInTheDocument();
  });

  it('disables duplication if limit reached', async function () {
    render(
      <MEPSettingProvider>
        <DashboardsMEPProvider>
          <WidgetCardContextMenu
            location={LocationFixture()}
            organization={OrganizationFixture({
              features: ['discover-basic', 'dashboards-edit'],
            })}
            router={RouterFixture()}
            selection={PageFiltersFixture()}
            widget={WidgetFixture({
              widgetType: WidgetType.DISCOVER,
            })}
            widgetLimitReached
            showContextMenu
          />
        </DashboardsMEPProvider>
      </MEPSettingProvider>
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));

    const $button = screen.getByRole('menuitemradio', {name: 'Duplicate Widget'});
    expect($button).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders the Open in Explore button for span widgets', async function () {
    render(
      <MEPSettingProvider>
        <DashboardsMEPProvider>
          <WidgetCardContextMenu
            location={LocationFixture()}
            organization={OrganizationFixture({})}
            router={RouterFixture()}
            selection={PageFiltersFixture()}
            widget={WidgetFixture({widgetType: WidgetType.SPANS})}
            widgetLimitReached={false}
            showContextMenu
          />
        </DashboardsMEPProvider>
      </MEPSettingProvider>
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));

    expect(await screen.findByText('Open in Explore')).toBeInTheDocument();
  });
});
