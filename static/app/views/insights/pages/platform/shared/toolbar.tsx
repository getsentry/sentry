import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';

type ExploreParams = Parameters<typeof getExploreUrl>[0];

interface ToolbarProps {
  onOpenFullScreen: () => void;
  exploreParams?: Omit<ExploreParams, 'organization' | 'selection'>;
  loaderSource?: LoadableChartWidgetProps['loaderSource'];
}

export function Toolbar({exploreParams, onOpenFullScreen, loaderSource}: ToolbarProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const project = useAlertsProject();

  const exploreUrl =
    exploreParams && getExploreUrl({...exploreParams, organization, selection});

  const yAxes = exploreParams?.visualize?.flatMap(v => v.yAxes) || [];

  const alertsUrls = yAxes.map((yAxis, index) => {
    return {
      key: `${yAxis}-${index}`,
      label: yAxis,
      to: getAlertsUrl({
        project,
        query: exploreParams?.query,
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        pageFilters: selection,
        aggregate: yAxis,
        organization,
      }),
    };
  });

  return (
    <Widget.WidgetToolbar>
      {exploreUrl ? (
        <BaseChartActionDropdown
          exploreUrl={exploreUrl}
          alertMenuOptions={alertsUrls}
          referrer={loaderSource || 'insights.platform.toolbar'}
        />
      ) : null}

      {loaderSource !== 'releases-drawer' && (
        <Button
          size="xs"
          aria-label={t('Open Full-Screen View')}
          borderless
          icon={<IconExpand />}
          onClick={onOpenFullScreen}
        />
      )}
    </Widget.WidgetToolbar>
  );
}
