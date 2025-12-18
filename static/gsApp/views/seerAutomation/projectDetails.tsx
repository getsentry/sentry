import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert/alert';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Stack} from '@sentry/scraps/layout/stack';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';
import OldProjectDetails from 'sentry/views/settings/projectSeer/index';

import AutofixRepositories from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';
import BackgroundAgentForm from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentForm';
import ProjectDetailsForm from 'getsentry/views/seerAutomation/components/projectDetails/projectDetailsForm';

export default function SeerProjectDetailsPage() {
  const organization = useOrganization();
  return showNewSeer(organization) ? <SeerProjectDetails /> : <OldProjectDetails />;
}

function SeerProjectDetails() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {codeMappingRepos, isPending, preference} = useProjectSeerPreferences(project);

  const canWrite = hasEveryAccess(['project:read'], {organization, project});

  if (!organization.features.includes('autofix-seer-preferences')) {
    return (
      <FeatureDisabled
        featureName={t('Autofix')}
        features={['autofix-seer-preferences']}
        hideHelpToggle
        message={t('Autofix is not enabled for this organization.')}
      />
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Project Seer Settings')}
        projectSlug={project.slug}
      />
      <SettingsPageHeader
        title={tct('Seer Settings for [projectName]', {
          projectName: <code>{project.slug}</code>,
        })}
        subtitle={t(
          'Choose how Seer automatically triages and diagnoses incoming issues, before you even notice them.'
        )}
        action={
          <LinkButton
            href="https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/"
            external
          >
            {t('Read the docs')}
          </LinkButton>
        }
      />
      {canWrite ? null : (
        <Stack paddingBottom="xl">
          <Alert data-test-id="org-permission-alert" type="warning">
            {t(
              'These settings can only be edited by users with the project owner or manager role.'
            )}
          </Alert>
        </Stack>
      )}
      {isPending || !preference ? (
        <LoadingIndicator />
      ) : (
        <Fragment>
          <ProjectDetailsForm
            canWrite={canWrite}
            preference={preference}
            project={project}
          />
          <BackgroundAgentForm
            canWrite={canWrite}
            project={project}
            preference={preference}
          />
          <AutofixRepositories
            canWrite={canWrite}
            codeMappingRepos={codeMappingRepos}
            preference={preference}
            project={project}
          />
        </Fragment>
      )}
    </Fragment>
  );
}
