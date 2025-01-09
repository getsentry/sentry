import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Feature from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconClose, IconCopy, IconDashboard, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMeasurement} from 'sentry/utils/metrics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import type {MetricsEquationWidget} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {useCreateDashboard} from 'sentry/views/metrics/useCreateDashboard';
import type {useFormulaDependencies} from 'sentry/views/metrics/utils/useFormulaDependencies';

type ContextMenuProps = {
  formulaDependencies: ReturnType<typeof useFormulaDependencies>;
  formulaWidget: MetricsEquationWidget;
  widgetIndex: number;
};

export function MetricFormulaContextMenu({
  widgetIndex,
  formulaWidget,
  formulaDependencies,
}: ContextMenuProps) {
  const organization = useOrganization();
  const {removeWidget, duplicateWidget, widgets} = useMetricsContext();
  const canDelete = widgets.length > 1;

  const createDashboardWidget = useCreateDashboardWidget(
    formulaWidget,
    formulaDependencies
  );

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
        leadingItems: [<IconDashboard key="icon" />],
        key: 'add-dashboard',
        label: (
          <Feature
            organization={organization}
            hookName="feature-disabled:dashboards-edit"
            features="dashboards-edit"
          >
            {({hasFeature}) => (
              <AddToDashboardItem disabled={!hasFeature}>
                {t('Add to Dashboard')}
              </AddToDashboardItem>
            )}
          </Feature>
        ),
        disabled: !createDashboardWidget,
        onAction: () => {
          if (!organization.features.includes('dashboards-edit')) {
            return;
          }
          trackAnalytics('ddm.add-to-dashboard', {
            organization,
            source: 'widget',
          });
          Sentry.metrics.increment('ddm.widget.dashboard');
          createDashboardWidget?.();
        },
      },
      {
        leadingItems: [<IconClose key="icon" />],
        key: 'delete',
        label: t('Remove Equation'),
        disabled: !canDelete,
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.delete');
          removeWidget(widgetIndex);
        },
      },
    ],
    [
      organization,
      createDashboardWidget,
      canDelete,
      duplicateWidget,
      widgetIndex,
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

function useCreateDashboardWidget(
  formulaWidget: MetricsEquationWidget,
  formulaDependencies: ReturnType<typeof useFormulaDependencies>
) {
  const {dependencies, isError} = formulaDependencies[formulaWidget.id]!;

  const widgetArray = useMemo(() => [formulaWidget], [formulaWidget]);
  const createDashboard = useCreateDashboard(widgetArray, formulaDependencies, false);

  if (!formulaWidget.formula || isError || dependencies.some(isCustomMeasurement)) {
    return undefined;
  }

  return createDashboard;
}

const AddToDashboardItem = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
