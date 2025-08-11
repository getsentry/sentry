import {Fragment} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

interface Props extends RouteComponentProps<{projectId: string}> {}

function ProjectCreateServiceHook({params}: Props) {
  const {projectId} = params;
  const organization = useOrganization();
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

export default ProjectCreateServiceHook;
