import {Fragment} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

type Props = RouteComponentProps<{projectId: string}> & {
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
