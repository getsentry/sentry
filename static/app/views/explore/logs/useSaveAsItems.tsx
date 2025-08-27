import {useMemo} from 'react';
import styled from '@emotion/styled';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useLogsSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {isLogsEnabled} from 'sentry/views/explore/logs/utils';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

interface UseSaveAsItemsOptions {
  groupBys: readonly string[];
  interval: string;
  mode: Mode;
  search: MutableSearch;
  sortBys: readonly Sort[];
  visualizes: readonly Visualize[];
}

export function useSaveAsItems({
  groupBys,
  interval,
  mode,
  search,
  sortBys,
  visualizes,
}: UseSaveAsItemsOptions) {
  const location = useLocation();
  const router = useRouter();
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const {saveQuery} = useLogsSaveQuery();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  const aggregates = useMemo(
    () => visualizes.map(visualize => visualize.yAxis),
    [visualizes]
  );

  const saveAsQuery = useMemo(() => {
    return {
      key: 'save-query',
      label: <span>{t('A New Query')}</span>,
      textValue: t('A New Query'),
      onAction: () => {
        trackAnalytics('logs.save_query_modal', {
          action: 'open',
          save_type: 'save_new_query',
          ui_source: 'table',
          organization,
        });
        openSaveQueryModal({
          organization,
          saveQuery,
          source: 'table',
          traceItemDataset: TraceItemDataset.LOGS,
        });
      },
    };
  }, [organization, saveQuery]);

  const saveAsAlert = useMemo(() => {
    const alertsUrls = aggregates.map((yAxis: string, index: number) => {
      const func = parseFunction(yAxis);
      const label = func ? prettifyParsedFunction(func) : yAxis;
      return {
        key: `${yAxis}-${index}`,
        label,
        to: getAlertsUrl({
          project,
          query: search.formatString(),
          pageFilters: pageFilters.selection,
          aggregate: yAxis,
          organization,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
          eventTypes: 'trace_item_log',
        }),
        onAction: () => {
          trackAnalytics('logs.save_as', {
            save_type: 'alert',
            ui_source: 'searchbar',
            organization,
          });
        },
      };
    });

    return {
      key: 'create-alert',
      label: t('An Alert for'),
      textValue: t('An Alert for'),
      children: alertsUrls ?? [],
      disabled: !alertsUrls || alertsUrls.length === 0,
      isSubmenu: true,
    };
  }, [aggregates, interval, organization, pageFilters, project, search]);

  const saveAsDashboard = useMemo(() => {
    const dashboardsUrls = aggregates.map((yAxis: string, index: number) => {
      const func = parseFunction(yAxis);
      const label = func ? prettifyParsedFunction(func) : yAxis;

      return {
        key: String(index),
        label,
        onAction: () => {
          trackAnalytics('logs.save_as', {
            save_type: 'dashboard',
            ui_source: 'searchbar',
            organization,
          });

          const fields =
            mode === Mode.SAMPLES
              ? []
              : [
                  ...new Set([
                    ...groupBys.filter(Boolean),
                    yAxis,
                    ...sortBys.map(sort => sort.field),
                  ]),
                ].filter(defined);

          const discoverQuery: NewQuery = {
            name: DEFAULT_WIDGET_NAME,
            fields,
            orderby: sortBys.map(formatSort),
            query: search.formatString(),
            version: 2,
            dataset: DiscoverDatasets.OURLOGS,
            yAxis: [yAxis],
          };

          const eventView = EventView.fromNewQueryWithPageFilters(
            discoverQuery,
            pageFilters.selection
          );
          // the chart currently track the chart type internally so force bar type for now
          eventView.display = DisplayType.BAR;

          handleAddQueryToDashboard({
            organization,
            location,
            eventView,
            router,
            yAxis: eventView.yAxis,
            widgetType: WidgetType.LOGS,
            source: DashboardWidgetSource.LOGS,
          });
        },
      };
    });

    return {
      key: 'add-to-dashboard',
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('A Dashboard widget')}</DisabledText>}
        >
          {t('A Dashboard widget')}
        </Feature>
      ),
      textValue: t('A Dashboard widget'),
      children: dashboardsUrls,
      disabled: !dashboardsUrls || dashboardsUrls.length === 0,
      isSubmenu: true,
    };
  }, [
    aggregates,
    groupBys,
    mode,
    organization,
    pageFilters,
    search,
    sortBys,
    location,
    router,
  ]);

  return useMemo(() => {
    const saveAs = [];
    if (isLogsEnabled(organization)) {
      saveAs.push(saveAsQuery);
      saveAs.push(saveAsAlert);
      saveAs.push(saveAsDashboard);
    }
    return saveAs;
  }, [organization, saveAsQuery, saveAsAlert, saveAsDashboard]);
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;
