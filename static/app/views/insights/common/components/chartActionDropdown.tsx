import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import Feature from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getIntervalForTimeSeriesQuery} from 'sentry/utils/timeSeries/getIntervalForTimeSeriesQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {
  useAddToSpanDashboard,
  type AddToSpanDashboardOptions,
} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
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

  const addToDashboardOptions: AddToSpanDashboardOptions = {
    chartType,
    yAxes,
    widgetName: title,
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
  addToDashboardOptions?: AddToSpanDashboardOptions | AddToSpanDashboardOptions[];
};

export function BaseChartActionDropdown({
  alertMenuOptions,
  exploreUrl,
  referrer,
  addToDashboardOptions,
}: BaseProps) {
  const organization = useOrganization();
  const hasDashboardEdit = organization.features.includes('dashboards-edit');
  const {addToSpanDashboard} = useAddToSpanDashboard();

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

  if (addToDashboardOptions) {
    const menuOption: MenuItemProps = {
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
      disabled: !hasDashboardEdit,
    };
    if (Array.isArray(addToDashboardOptions)) {
      menuOption.isSubmenu = true;
      menuOption.children = addToDashboardOptions.map((option, idx) => ({
        key: `${option.chartType}-${idx}-${option.yAxes}`,
        label: option.widgetName,
        onAction: () => {
          addToSpanDashboard(option);
        },
      }));
    } else {
      menuOption.isSubmenu = false;
      menuOption.onAction = () => {
        addToSpanDashboard(addToDashboardOptions);
      };
    }
    menuOptions.push(menuOption);
  }

  const newAlertLabel = organization.features.includes('workflow-engine-ui')
    ? t('Create a Monitor for')
    : t('Create an Alert for');

  if (alertMenuOptions.length > 0) {
    menuOptions.push({
      key: 'create-alert',
      label: newAlertLabel,
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

const DisabledText = styled('span')`
  color: ${p => p.theme.tokens.content.disabled};
`;
