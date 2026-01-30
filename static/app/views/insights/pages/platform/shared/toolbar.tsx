import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {AddToSpanDashboardOptions} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import type {SpanFields} from 'sentry/views/insights/types';

type ExploreParams = Parameters<typeof getExploreUrl>[0];

interface ToolbarProps {
  onOpenFullScreen: () => void;
  aliases?: Record<string, string>;
  exploreParams?: Omit<ExploreParams, 'organization' | 'selection'>;
  loaderSource?: LoadableChartWidgetProps['loaderSource'];
  referrer?: string;
  // TODO: this is temporary so we can slowly add create alert/dashboard functionality, in the future all charts that can open in explore can be alerted
  showAddToDashboard?: boolean;
  showCreateAlert?: boolean;
}

export function Toolbar({
  exploreParams,
  onOpenFullScreen,
  loaderSource,
  aliases,
  showCreateAlert = false,
  showAddToDashboard = false,
  referrer: referrerProp,
}: ToolbarProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const project = useAlertsProject();

  const referrer = loaderSource || referrerProp || 'insights.platform.toolbar';

  const exploreUrl =
    exploreParams && getExploreUrl({...exploreParams, organization, selection, referrer});

  const yAxes = exploreParams?.visualize?.flatMap(v => v.yAxes) || [];

  const alertsUrls = yAxes.map((yAxis, index) => {
    const label = aliases?.[yAxis] ?? yAxis;
    return {
      key: `${yAxis}-${index}`,
      label,
      to: getAlertsUrl({
        project,
        query: exploreParams?.query,
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        pageFilters: selection,
        aggregate: yAxis,
        organization,
        referrer,
      }),
    };
  });

  let addToDashboardOptions:
    | AddToSpanDashboardOptions
    | AddToSpanDashboardOptions[]
    | undefined = undefined;
  const visualize = exploreParams?.visualize;
  if (showAddToDashboard && visualize) {
    if (visualize[0] && visualize.length === 1) {
      addToDashboardOptions = {
        chartType: visualize[0].chartType || ChartType.LINE,
        yAxes,
        groupBy: (exploreParams?.groupBy as SpanFields[]) ?? [],
        search: new MutableSearch(exploreParams?.query || ''),
        sort: decodeSorts(exploreParams?.sort).at(0),
        widgetName: exploreParams?.title,
      } satisfies AddToSpanDashboardOptions;
    }
    if (visualize.length > 1) {
      addToDashboardOptions = visualize.map(v => ({
        chartType: v.chartType || ChartType.LINE,
        yAxes: [...v.yAxes],
        groupBy: (exploreParams?.groupBy as SpanFields[]) ?? [],
        search: new MutableSearch(exploreParams?.query || ''),
        sort: decodeSorts(exploreParams?.sort).at(0),
        widgetName: v.yAxes[0],
      })) satisfies AddToSpanDashboardOptions[];
    }
  }

  return (
    <Widget.WidgetToolbar>
      {exploreUrl ? (
        <BaseChartActionDropdown
          exploreUrl={exploreUrl}
          addToDashboardOptions={addToDashboardOptions}
          alertMenuOptions={showCreateAlert ? alertsUrls : []}
          referrer={referrer}
        />
      ) : null}

      {loaderSource !== 'releases-drawer' && (
        <Button
          size="xs"
          aria-label={t('Open Full-Screen View')}
          priority="transparent"
          icon={<IconExpand />}
          onClick={onOpenFullScreen}
        />
      )}
    </Widget.WidgetToolbar>
  );
}
