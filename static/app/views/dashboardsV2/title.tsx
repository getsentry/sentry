import EditableText from 'app/components/editableText';
import {t} from 'app/locale';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

function DashboardTitle({dashboard, isEditing, onUpdate}: Props) {
  return (
    <div>
      {!dashboard ? (
        t('Dashboards')
      ) : (
        <EditableText
          isDisabled={!isEditing}
          value={dashboard.title}
          onChange={newTitle => onUpdate({...dashboard, title: newTitle})}
          errorMessage={t('Please set a title for this dashboard')}
          successMessage={t('Dashboard title updated successfully')}
        />
      )}
    </div>
  );
}

export default DashboardTitle;
