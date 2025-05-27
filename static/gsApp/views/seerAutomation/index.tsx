import {Fragment} from 'react';

import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {SeerAutomationDefault} from './seerAutomationDefault';
import {SeerAutomationProjectList} from './seerAutomationProjectList';

function SeerAutomationRoot() {
  const organization = useOrganization();
  if (!organization.features.includes('trigger-autofix-on-issue-summary')) {
    return <NoAccess />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Seer Automation')}
        subtitle={t(
          'Seer can automatically find a root cause and solution for incoming issues.'
        )}
      />
      <ProjectPermissionAlert />

      <NoProjectMessage organization={organization}>
        <SeerAutomationDefault />
        <SeerAutomationProjectList />
      </NoProjectMessage>
    </Fragment>
  );
}

export default SeerAutomationRoot;
