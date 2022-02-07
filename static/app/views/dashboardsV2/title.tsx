import EditableText from 'sentry/components/editableText';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
  organization: Organization;
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
        />
      )}
    </div>
  );
}

export default withOrganization(DashboardTitle);
