import {Fragment} from 'react';

import {EditableText} from 'sentry/components/editableText';
import {t} from 'sentry/locale';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import type {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditingDashboard: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

export function DashboardTitle({dashboard, isEditingDashboard, onUpdate}: Props) {
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Fragment>
      {dashboard ? (
        <EditableText
          isDisabled={!isEditingDashboard}
          value={dashboard.title}
          onChange={newTitle => onUpdate({...dashboard, title: newTitle})}
          errorMessage={t('Please set a title for this dashboard')}
          autoSelect
          variant={hasPageFrame ? 'compact' : undefined}
        />
      ) : (
        t('Dashboards')
      )}
    </Fragment>
  );
}
