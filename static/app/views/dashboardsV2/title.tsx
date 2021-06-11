import EditableText from 'app/components/editableText';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  organization: Organization;
  onUpdate: (dashboard: DashboardDetails) => void;
};

function DashboardTitle({dashboard, isEditing, organization, onUpdate}: Props) {
  return (
    <div>
      {!dashboard ? (
        t('Dashboards')
      ) : (
        <EditableText
          isDisabled={!isEditing}
          value={
            organization.features.includes('dashboards-edit') &&
            dashboard.id === 'default-overview'
              ? 'Default Dashboard'
              : dashboard.title
          }
          onChange={newTitle => onUpdate({...dashboard, title: newTitle})}
          errorMessage={t('Please set a title for this dashboard')}
          successMessage={t('Dashboard title updated successfully')}
        />
      )}
    </div>
  );
}

export default withOrganization(DashboardTitle);
