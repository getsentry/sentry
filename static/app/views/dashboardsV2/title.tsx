import {Fragment} from 'react';

import EditableText from 'sentry/components/editableText';
import {t} from 'sentry/locale';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

function DashboardTitle({dashboard, isEditing, onUpdate}: Props) {
  return (
    <Fragment>
      {!dashboard ? (
        t('Dashboards')
      ) : (
        <EditableText
          isDisabled={!isEditing}
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
