import {Fragment} from 'react';

import EditableText from 'sentry/components/editableText';
import {t} from 'sentry/locale';

import type {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditingDashboard: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

function DashboardTitle({dashboard, isEditingDashboard, onUpdate}: Props) {
  return (
    <Fragment>
      {!dashboard ? (
        t('Dashboards')
      ) : (
        <EditableText
          isDisabled={!isEditingDashboard}
          value={dashboard.title}
          onChange={newTitle => onUpdate({...dashboard, title: newTitle})}
          errorMessage={t('Please set a title for this dashboard')}
          autoSelect
        />
      )}
    </Fragment>
  );
}

export default DashboardTitle;
