import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
};

function ProjectCreateServiceHook({organization, params}: Props) {
  const {projectId} = params;
  const title = t('Create Service Hook');

  return (
    <SentryDocumentTitle title={title}>
      <Fragment>
        <SettingsPageHeader title={title} />
        <ServiceHookSettingsForm
          organization={organization}
          projectId={projectId}
          initialData={{events: [], isActive: true}}
        />
      </Fragment>
    </SentryDocumentTitle>
  );
}

export default withOrganization(ProjectCreateServiceHook);
