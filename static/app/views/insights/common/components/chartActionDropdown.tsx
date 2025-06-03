import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {SpanFields} from 'sentry/views/insights/types';

type Props = {
  chartType: ChartType;
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
}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${selection.projects[0]}`);

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
      }),
    };
  });

  const menuOptions: MenuItemProps[] = [
    {
      key: 'open-in-explore',
      label: t('Open in Explore'),
      to: exploreUrl,
    },
    {
      key: 'create-alert',
      label: t('Create Alert for'),
      isSubmenu: true,
      children: alertsUrls,
    },
  ];
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
