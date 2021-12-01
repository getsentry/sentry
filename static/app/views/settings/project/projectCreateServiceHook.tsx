import {Fragment} from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router';

import {t} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}>;

function ProjectCreateServiceHook({params}: Props) {
  const {orgId, projectId} = params;
  const title = t('Create Service Hook');
  return (
    <DocumentTitle title={`${title} - Sentry`}>
      <Fragment>
        <SettingsPageHeader title={title} />
        <ServiceHookSettingsForm
          orgId={orgId}
          projectId={projectId}
          initialData={{events: [], isActive: true}}
        />
      </Fragment>
    </DocumentTitle>
  );
}

export default ProjectCreateServiceHook;
