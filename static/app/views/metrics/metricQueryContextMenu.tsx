import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconClose, IconCopy, IconEllipsis, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMetric, isVirtualMetric} from 'sentry/utils/metrics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import {
  isMetricsQueryWidget,
  type MetricDisplayType,
  type MetricsQuery,
} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
  widgetIndex: number;
};

export function MetricQueryContextMenu({metricsQuery, widgetIndex}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();

  const {removeWidget, duplicateWidget, widgets} = useMetricsContext();

  // At least one query must remain
  const canDelete = widgets.filter(isMetricsQueryWidget).length > 1;

  const items = useMemo<MenuItemProps[]>(
    () => [
      {
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
      },
      {
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
              `/settings/projects/:projectId/metrics/${encodeURIComponent(
                metricsQuery.mri
              )}`,
              router
            );
          }
        },
      },
      {
        leadingItems: [<IconClose key="icon" />],
        key: 'delete',
        label: t('Remove Metric'),
        disabled: !canDelete,
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.delete');
          removeWidget(widgetIndex);
        },
      },
    ],
    [
      organization,
      metricsQuery,

      canDelete,
      duplicateWidget,
      widgetIndex,
      router,
      removeWidget,
    ]
  );

  if (!hasCustomMetrics(organization)) {
    return null;
  }

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
