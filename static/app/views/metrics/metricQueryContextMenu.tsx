import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Hovercard} from 'sentry/components/hovercard';
import {CreateMetricAlertFeature} from 'sentry/components/metrics/createMetricAlertFeature';
import {
  IconClose,
  IconCopy,
  IconDashboard,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMeasurement, isCustomMetric, isVirtualMetric} from 'sentry/utils/metrics';
import {hasCustomMetrics, hasMetricAlertFeature} from 'sentry/utils/metrics/features';
import {
  isMetricsQueryWidget,
  type MetricDisplayType,
  type MetricsQuery,
} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {openCreateAlertModal} from 'sentry/views/metrics/createAlertModal';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
  widgetIndex: number;
};

export function MetricQueryContextMenu({metricsQuery, widgetIndex}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();

  const {removeWidget, duplicateWidget, widgets} = useMetricsContext();
  const createAlert = getCreateAlert(organization, metricsQuery);

  // At least one query must remain
  const canDelete = widgets.filter(isMetricsQueryWidget).length > 1;

  const items = useMemo<MenuItemProps[]>(() => {
    const duplicateItem = {
      leadingItems: [<IconCopy key="icon" />],
      key: 'duplicate',
      label: t('Duplicate'),
      onAction: () => {
        trackAnalytics('ddm.widget.duplicate', {
          organization,
        });
        Sentry.metrics.increment('ddm.widget.duplicate');
        duplicateWidget(widgetIndex);
      },
    };

    const createAlertItem = {
      leadingItems: [<IconSiren key="icon" />],
      key: 'add-alert',
      label: <CreateMetricAlertFeature>{t('Create Alert')}</CreateMetricAlertFeature>,
      disabled: !createAlert || !hasMetricAlertFeature(organization),
      onAction: () => {
        trackAnalytics('ddm.create-alert', {
          organization,
          source: 'widget',
        });
        Sentry.metrics.increment('ddm.widget.alert');
        createAlert?.();
      },
    };

    const addToDashboardItem = {
      leadingItems: [<IconDashboard key="icon" />],
      key: 'add-dashboard',
      label: (
        <Feature
          organization={organization}
          hookName="feature-disabled:dashboards-edit"
          features="dashboards-edit"
          renderDisabled={p => (
            <Hovercard
              body={
                <FeatureDisabled
                  features={p.features}
                  hideHelpToggle
                  featureName={t('Metric Alerts')}
                />
              }
            >
              {typeof p.children === 'function' ? p.children(p) : p.children}
            </Hovercard>
          )}
        >
          <span>{t('Add to Dashboard')}</span>
        </Feature>
      ),
      onAction: () => {
        if (!organization.features.includes('dashboards-edit')) {
          return;
        }
        trackAnalytics('ddm.add-to-dashboard', {
          organization,
          source: 'widget',
        });
        Sentry.metrics.increment('ddm.widget.dashboard');
      },
    };

    const settingsItem = {
      leadingItems: [<IconSettings key="icon" />],
      key: 'settings',
      disabled: !isCustomMetric({mri: metricsQuery.mri}),
      label: t('Configure Metric'),
      onAction: () => {
        trackAnalytics('ddm.widget.settings', {
          organization,
        });
        Sentry.metrics.increment('ddm.widget.settings');

        if (!isVirtualMetric(metricsQuery)) {
          navigateTo(
            `/settings/${organization.slug}/projects/:projectId/metrics/${encodeURIComponent(
              metricsQuery.mri
            )}`,
            router
          );
        }
      },
    };

    const deleteItem = {
      leadingItems: [<IconClose key="icon" />],
      key: 'delete',
      label: t('Delete'),
      disabled: !canDelete,
      onAction: () => {
        trackAnalytics('ddm.widget.delete', {
          organization,
        });
        Sentry.metrics.increment('ddm.widget.delete');
        removeWidget(widgetIndex);
      },
    };

    if (hasCustomMetrics(organization)) {
      return [
        duplicateItem,
        createAlertItem,
        addToDashboardItem,
        settingsItem,
        deleteItem,
      ];
    }
    return [duplicateItem, settingsItem, deleteItem];
  }, [
    createAlert,
    organization,
    metricsQuery,

    canDelete,
    duplicateWidget,
    widgetIndex,
    router,
    removeWidget,
  ]);

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        'aria-label': t('Widget actions'),
        size: 'md',
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

function canCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  return (
    organization.access.includes('alerts:write') &&
    metricsQuery.mri &&
    metricsQuery.aggregation &&
    !isCustomMeasurement(metricsQuery)
  );
}

export function getCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  if (!canCreateAlert(organization, metricsQuery)) {
    return undefined;
  }
  return function () {
    openCreateAlertModal({metricsQuery, organization});
  };
}
