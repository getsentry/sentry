import {useMemo} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {
  isVisualizeEquation,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
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

  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const items = useMemo(() => {
    const menuItems = [];

    const project =
      projects.length === 1
        ? projects[0]
        : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

    if (visualizeYAxes.length === 1) {
      const yAxis = visualizeYAxes[0]!.yAxis;
      menuItems.push(
        getSaveAsAlertMenuItem({
          disabled: isVisualizeEquation(visualizeYAxes[0]!),
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
        })
      );
    } else {
      const alertsUrls = visualizeYAxes.map((visualizeYAxis, index) => ({
        key: `${visualizeYAxis.yAxis}-${index}`,
        label: visualizeYAxis.yAxis,
        disabled: isVisualizeEquation(visualizeYAxis),
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

      menuItems.push(
        getSaveAsAlertMenuItem({
          alertsUrls,
          submenu: true,
          label: getCreateAlertForLabel(),
        })
      );
    }

    const disableAddToDashboard = !organization.features.includes('dashboards-edit');
    menuItems.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: (
        <Feature
          overrideName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
        >
          {t('Add to Dashboard')}
        </Feature>
      ),
      disabled: disableAddToDashboard,
      onAction: () => {
        if (disableAddToDashboard) {
          return;
        }
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'dashboard',
          ui_source: 'chart',
          organization,
        });
        return addToDashboard(visualizeIndex);
      },
    });

    return menuItems;
  }, [
    addToDashboard,
    organization,
    projects,
    pageFilters,
    interval,
    query,
    visualizeIndex,
    visualizeYAxes,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      triggerProps={{
        size: 'xs',
        variant: 'transparent',
        showChevron: false,
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}

export const DisabledText = styled('span')`
  color: ${p => p.theme.tokens.content.disabled};
`;
