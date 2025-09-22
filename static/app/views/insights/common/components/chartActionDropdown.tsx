import {useCallback} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import Feature from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getIntervalForTimeSeriesQuery} from 'sentry/utils/timeSeries/getIntervalForTimeSeriesQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  DashboardWidgetSource,
  DEFAULT_WIDGET_NAME,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {CHART_TYPE_TO_DISPLAY_TYPE} from 'sentry/views/explore/hooks/useAddToDashboard';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import type {SpanFields} from 'sentry/views/insights/types';

type Props = {
  chartType: ChartType;
  referrer: string;
  yAxes: string[];
  aliases?: Record<string, string>;
  groupBy?: SpanFields[];
  interval?: string;
  search?: MutableSearch;
  title?: string;
};

export function ChartActionDropdown({
  chartType,
  yAxes,
  groupBy,
  search,
  title,
  aliases,
  referrer,
  interval,
}: Props) {
  const organization = useOrganization();
  const project = useAlertsProject();
  const {selection} = usePageFilters();

  const queryInterval =
    interval ?? getIntervalForTimeSeriesQuery(yAxes, selection.datetime);

  const exploreUrl = getExploreUrl({
    selection,
    organization,
    visualize: [
      {
        chartType,
        yAxes,
      },
    ],
    mode: Mode.AGGREGATE,
    title: title ?? yAxes[0],
    query: search?.formatString(),
    sort: undefined,
    groupBy,
    interval: queryInterval,
    referrer,
  });

  const alertsUrls = yAxes.map((yAxis, index) => {
    const label = aliases?.[yAxis] ?? yAxis;
    return {
      key: `${yAxis}-${index}`,
      label,
      to: getAlertsUrl({
        project,
        query: search?.formatString(),
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        pageFilters: selection,
        aggregate: yAxis,
        organization,
        referrer,
        interval: queryInterval,
      }),
    };
  });

  const addToDashboardOptions: AddToDashboardOptions = {
    chartType,
    yAxes,
    widgetName: title ?? DEFAULT_WIDGET_NAME,
    groupBy,
    search,
  };

  return (
    <BaseChartActionDropdown
      alertMenuOptions={alertsUrls}
      exploreUrl={exploreUrl}
      addToDashboardOptions={addToDashboardOptions}
      referrer={referrer}
    />
  );
}

type BaseProps = {
  alertMenuOptions: MenuItemProps[];
  exploreUrl: LocationDescriptor;
  referrer: string;
  addToDashboardOptions?: AddToDashboardOptions;
};

export function BaseChartActionDropdown({
  alertMenuOptions,
  exploreUrl,
  referrer,
  addToDashboardOptions,
}: BaseProps) {
  const organization = useOrganization();
  const hasDashboardEdit = organization.features.includes('dashboards-edit');
  const {addToDashboard} = useAddToDashboard();

  const menuOptions: MenuItemProps[] = [
    {
      key: 'open-in-explore',
      label: t('Open in Explore'),
      to: exploreUrl,
      onAction: () => {
        trackAnalytics('insights.open_in_explore', {
          organization,
          referrer,
        });
      },
    },
  ];

  if (alertMenuOptions.length > 0) {
    menuOptions.push({
      key: 'create-alert',
      label: t('Create Alert for'),
      isSubmenu: true,
      children: alertMenuOptions.map(option => ({
        ...option,
        onAction: () => {
          option.onAction?.();
          trackAnalytics('insights.create_alert', {
            organization,
            referrer,
          });
        },
      })),
    });
  }

  if (addToDashboardOptions) {
    menuOptions.push({
      key: 'add-to-dashboard',
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
        >
          {t('Add to Dashboard')}
        </Feature>
      ),
      textValue: t('Add to Dashboard'),
      onAction: () => {
        addToDashboard(addToDashboardOptions);
      },
      isSubmenu: false,
      disabled: !hasDashboardEdit,
    });
  }

  return (
    <DropdownMenu
      items={menuOptions}
      triggerProps={{
        'aria-label': t('Widget actions'),
        size: 'xs',
        borderless: true,
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

type AddToDashboardOptions = {
  chartType: ChartType;
  widgetName: string;
  yAxes: string[];
  groupBy?: SpanFields[];
  search?: MutableSearch;
};

const useAddToDashboard = () => {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const router = useRouter();

  const addToDashboard = useCallback(
    ({
      yAxes,
      groupBy = [],
      search = new MutableSearch(''),
      chartType,
      widgetName,
    }: AddToDashboardOptions) => {
      const fields = [...groupBy, ...yAxes];
      const dataset = DiscoverDatasets.SPANS;

      const discoverQuery: NewQuery = {
        name: widgetName,
        fields,
        query: search.formatString(),
        version: 2,
        dataset,
        yAxis: yAxes,
      };

      const eventView = EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
      eventView.dataset = dataset;
      eventView.display = CHART_TYPE_TO_DISPLAY_TYPE[chartType];

      handleAddQueryToDashboard({
        eventView,
        organization,
        yAxis: yAxes,
        query: discoverQuery,
        location,
        router,
        source: DashboardWidgetSource.INSIGHTS,
        widgetType: WidgetType.SPANS,
      });
    },
    [organization, selection, location, router]
  );

  return {
    addToDashboard,
  };
};

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;
