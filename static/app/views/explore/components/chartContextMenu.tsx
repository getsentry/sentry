import {useMemo} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useAlwaysMatchesCaseDetails} from 'sentry/views/explore/caseInsensitivityDefault';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {
  useQueryParamsGroupBys,
  useQueryParamsHasTransformations,
  useQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeEquation,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {hasConditionalAggregateFilter} from 'sentry/views/explore/utils/conditionalAggregate';
import {
  getCreateAlertForLabel,
  getSaveAsAlertMenuItem,
} from 'sentry/views/explore/utils/saveAsAlertMenuItem';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

export function ChartContextMenu({
  visualizeIndex,
  visualizeYAxes,
  query,
  interval,
}: {
  interval: string;
  query: string;
  visualizeIndex: number;
  visualizeYAxes: readonly Visualize[];
}) {
  const {addToDashboard} = useAddToDashboard();
  const organization = useOrganization();
  const hasTransformations = useQueryParamsHasTransformations();

  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const groupBys = useQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const yAxes = visualizeYAxes.map(visualizeYAxis => visualizeYAxis.yAxis);
  const {alert: alertCaseDetails, dashboard: dashboardCaseDetails} =
    useAlwaysMatchesCaseDetails({query, yAxes, groupBys, mode});

  const items = useMemo(() => {
    const menuItems = [];

    const project =
      projects.length === 1
        ? projects[0]
        : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

    if (visualizeYAxes.length === 1) {
      const yAxis = visualizeYAxes[0]!.yAxis;
      menuItems.push({
        ...getSaveAsAlertMenuItem({
          disabled:
            hasTransformations ||
            isVisualizeEquation(visualizeYAxes[0]!) ||
            hasConditionalAggregateFilter(yAxis),
          to: getAlertsUrl({
            project,
            query,
            pageFilters: pageFilters.selection,
            aggregate: yAxis,
            organization,
            dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
            interval,
          }),
          onAction: () => {
            trackAnalytics('trace_explorer.save_as', {
              save_type: 'alert',
              ui_source: 'chart',
              organization,
            });
            return;
          },
        }),
        details: alertCaseDetails,
      });
    } else {
      const alertsUrls = visualizeYAxes.map((visualizeYAxis, index) => ({
        key: `${visualizeYAxis.yAxis}-${index}`,
        label: visualizeYAxis.yAxis,
        disabled:
          isVisualizeEquation(visualizeYAxis) ||
          hasConditionalAggregateFilter(visualizeYAxis.yAxis),
        to: getAlertsUrl({
          project,
          query,
          pageFilters: pageFilters.selection,
          aggregate: visualizeYAxis.yAxis,
          organization,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          interval,
        }),
        onAction: () => {
          trackAnalytics('trace_explorer.save_as', {
            save_type: 'alert',
            ui_source: 'chart',
            organization,
          });
          return;
        },
      }));

      menuItems.push({
        ...getSaveAsAlertMenuItem({
          alertsUrls,
          disabled: hasTransformations,
          submenu: true,
          label: getCreateAlertForLabel(),
        }),
        details: alertCaseDetails,
      });
    }

    menuItems.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      details: dashboardCaseDetails,
      label: t('Add to Dashboard'),
      onAction: () => {
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'dashboard',
          ui_source: 'chart',
          organization,
        });
        return addToDashboard(visualizeIndex, {includeChartGroup: true});
      },
    });

    return menuItems;
  }, [
    addToDashboard,
    alertCaseDetails,
    dashboardCaseDetails,
    organization,
    projects,
    pageFilters,
    interval,
    query,
    visualizeIndex,
    visualizeYAxes,
    hasTransformations,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          variant="transparent"
          icon={<IconEllipsis />}
          aria-label={t('Chart actions')}
        />
      )}
      position="bottom-end"
      items={items}
    />
  );
}
