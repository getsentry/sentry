import type {LocationDescriptor} from 'history';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {SpanFields} from 'sentry/views/insights/types';

type Props = {
  chartType: ChartType;
  referrer: string;
  yAxes: string[];
  aliases?: Record<string, string>;
  groupBy?: SpanFields[];
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
}: Props) {
  const organization = useOrganization();
  const project = useAlertsProject();
  const {selection} = usePageFilters();

  const exploreUrl = getExploreUrl({
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
      }),
    };
  });

  return (
    <BaseChartActionDropdown
      alertMenuOptions={alertsUrls}
      exploreUrl={exploreUrl}
      referrer={referrer}
    />
  );
}

type BaseProps = {
  alertMenuOptions: MenuItemProps[];
  exploreUrl: LocationDescriptor;
  referrer: string;
};

export function BaseChartActionDropdown({
  alertMenuOptions,
  exploreUrl,
  referrer,
}: BaseProps) {
  const organization = useOrganization();
  const useEap = useInsightsEap();
  const hasChartActionsEnabled =
    organization.features.includes('insights-chart-actions') && useEap;

  const menuOptions: MenuItemProps[] = [
    {
      key: 'open-in-explore',
      label: t('Open in Explore'),
      to: exploreUrl,
      onAction: () => {
        trackAnalytics('insights.open_in_explore', {
          organization: organization.slug,
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
            organization: organization.slug,
            referrer,
          });
        },
      })),
    });
  }

  if (!hasChartActionsEnabled) {
    return null;
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
