import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';

import type {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditingDashboard: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

export function DashboardTitle({dashboard, isEditingDashboard, onUpdate}: Props) {
  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={
        dashboard
          ? {
              type: 'editable-title',
              value: dashboard.title,
              onChange: newTitle => onUpdate({...dashboard, title: newTitle}),
              errorMessage: t('Please set a title for this dashboard'),
              autoSelect: true,
              isDisabled: !isEditingDashboard,
              'aria-label': t('Dashboard name'),
            }
          : {type: 'page-title', label: t('Dashboards')}
      }
    />
  );
}
