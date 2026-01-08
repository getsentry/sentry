import {useMemo} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {
  isVisualizeEquation,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

function ChartContextMenu({
  visualizeIndex,
  visualizeYAxes,
  query,
  interval,
  visible,
  setVisible,
}: {
  interval: string;
  query: string;
  setVisible: (visible: boolean) => void;
  visible: boolean;
  visualizeIndex: number;
  visualizeYAxes: readonly Visualize[];
}) {
  const {addToDashboard} = useAddToDashboard();
  const organization = useOrganization();

  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const items: MenuItemProps[] = useMemo(() => {
    const menuItems = [];

    const project =
      projects.length === 1
        ? projects[0]
        : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

    if (visualizeYAxes.length === 1) {
      const newAlertLabel = organization.features.includes('workflow-engine-ui')
        ? t('Create a Monitor')
        : t('Create an Alert');

      const yAxis = visualizeYAxes[0]!.yAxis;
      menuItems.push({
        key: 'create-alert',
        textValue: newAlertLabel,
        label: newAlertLabel,
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
          return undefined;
        },
      });
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
          return undefined;
        },
      }));

      const newAlertLabel = organization.features.includes('workflow-engine-ui')
        ? t('Create a Monitor for')
        : t('Create an Alert for');

      menuItems.push({
        key: 'create-alert',
        label: newAlertLabel,
        children: alertsUrls ?? [],
        disabled: !alertsUrls || alertsUrls.length === 0,
        isSubmenu: true,
      });
    }

    const disableAddToDashboard = !organization.features.includes('dashboards-edit');
    menuItems.push({
      key: 'add-to-dashboard',
      textValue: t('Add to Dashboard'),
      label: (
        <Feature
          hookName="feature-disabled:dashboards-edit"
          features="organizations:dashboards-edit"
          renderDisabled={() => <DisabledText>{t('Add to Dashboard')}</DisabledText>}
        >
          {t('Add to Dashboard')}
        </Feature>
      ),
      disabled: disableAddToDashboard,
      onAction: () => {
        if (disableAddToDashboard) {
          return undefined;
        }
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'dashboard',
          ui_source: 'chart',
          organization,
        });
        return addToDashboard(visualizeIndex);
      },
    });

    if (visible) {
      menuItems.push({
        key: 'hide-chart',
        textValue: t('Hide Chart'),
        label: t('Hide Chart'),
        onAction: () => setVisible(false),
      });
    } else {
      menuItems.push({
        key: 'show-chart',
        textValue: t('Show Chart'),
        label: t('Show Chart'),
        onAction: () => setVisible(true),
      });
    }

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
    visible,
    setVisible,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      triggerProps={{
        size: 'xs',
        borderless: true,
        showChevron: false,
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}

export default ChartContextMenu;

const DisabledText = styled('span')`
  color: ${p => p.theme.tokens.content.disabled};
`;
