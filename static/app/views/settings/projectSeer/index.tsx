import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {NoAccess} from 'sentry/components/noAccess';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {AutofixRepositories} from './autofixRepositories';

const AiSetupDataConsent = HookOrDefault({
  hookName: 'component:ai-setup-data-consent',
  defaultComponent: () => <div data-test-id="ai-setup-data-consent" />,
});

interface ProjectSeerProps {
  project: Project;
}

export const SEER_THRESHOLD_MAP = [
  'off',
  'super_low',
  'low',
  'medium',
  'high',
  'always',
] as const;

const SeerSelectLabel = styled('div')`
  margin-bottom: ${space(0.5)};
`;

export const seerScannerAutomationField = {
  name: 'seerScannerAutomation',
  label: t('Automate Issue Scans'),
  help: () =>
    t(
      'Seer will scan all new issues in your project, helping you focus on the most actionable and quick-to-fix ones, giving more context in Slack alerts, and enabling automatic Issue Fixes.'
    ),
  type: 'boolean',
  saveOnBlur: true,
} satisfies FieldObject;

export const autofixAutomatingTuningField = {
  name: 'autofixAutomationTuning',
  label: t('Automate Issue Fixes'),
  help: () =>
    t(
      "Seer will automatically find a root cause and solution for incoming issues if it thinks the issue is actionable enough. By default, it won't open PRs without your approval."
    ),
  type: 'choice',
  options: [
    {
      value: 'off',
      label: <SeerSelectLabel>{t('Off')}</SeerSelectLabel>,
      details: t('Seer will never analyze any issues without manually clicking Start.'),
    },
    {
      value: 'super_low',
      label: <SeerSelectLabel>{t('Only the Most Actionable Issues')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "super high." This targets around 2% of issues, but may vary by project.'
      ),
    },
    {
      value: 'low',
      label: <SeerSelectLabel>{t('Highly Actionable and Above')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "high" or above. This targets around 10% of issues, but may vary by project.'
      ),
    },
    {
      value: 'medium',
      label: <SeerSelectLabel>{t('Moderately Actionable and Above')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "medium" or above. This targets around 30% of issues, but may vary by project.'
      ),
    },
    {
      value: 'high',
      label: <SeerSelectLabel>{t('Minimally Actionable and Above')}</SeerSelectLabel>,
      details: t(
        'Seer will automatically run on issues that it thinks have an actionability of "low" or above. This targets around 70% of issues, but may vary by project.'
      ),
    },
    {
      value: 'always',
      label: <SeerSelectLabel>{t('All Issues')}</SeerSelectLabel>,
      details: t('Seer will automatically run on all new issues.'),
    },
  ],
  saveOnBlur: true,
  saveMessage: t('Automatic Seer settings updated'),
  visible: ({model}) => model?.getValue('seerScannerAutomation') === true,
} satisfies FieldObject;

function ProjectSeerGeneralForm({project}: ProjectSeerProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {preference} = useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const canWriteProject = hasEveryAccess(['project:write'], {organization, project});

  const handleSubmitSuccess = useCallback(
    (resp: Project) => {
      const projectId = project.slug;

      const projectSettingsQueryKey: ApiQueryKey = [
        `/projects/${organization.slug}/${projectId}/`,
      ];
      setApiQueryData(queryClient, projectSettingsQueryKey, resp);
      ProjectsStore.onUpdateSuccess(resp);
    },
    [project.slug, queryClient, organization.slug]
  );

  const handleStoppingPointChange = useCallback(
    (value: 'solution' | 'code_changes' | 'open_pr') => {
      updateProjectSeerPreferences({
        repositories: preference?.repositories || [],
        automated_run_stopping_point: value,
      });
    },
    [updateProjectSeerPreferences, preference?.repositories]
  );

  const automatedRunStoppingPointField = {
    name: 'automated_run_stopping_point',
    label: t('Stopping Point for Automatic Fixes'),
    help: () =>
      t(
        'Choose how far Seer should go without your approval when running automatically. This does not affect Issue Fixes that you manually start.'
      ),
    type: 'choice',
    options: [
      {
        value: 'solution',
        label: <SeerSelectLabel>{t('Solution (default)')}</SeerSelectLabel>,
        details: t('Seer will stop after planning out a solution.'),
      },
      {
        value: 'code_changes',
        label: <SeerSelectLabel>{t('Code Changes')}</SeerSelectLabel>,
        details: t('Seer will stop after writing the code changes.'),
      },
      {
        value: 'open_pr',
        label: <SeerSelectLabel>{t('Pull Request')}</SeerSelectLabel>,
        details: t('Seer will go all the way and open a pull request automatically.'),
      },
    ],
    saveOnBlur: true,
    saveMessage: t('Stopping point updated'),
    onChange: handleStoppingPointChange,
    visible: ({model}) =>
      model?.getValue('seerScannerAutomation') === true &&
      model?.getValue('autofixAutomationTuning') !== 'off',
  } satisfies FieldObject;

  const seerFormGroups: JsonFormObject[] = [
    {
      title: t('Automation'),
      fields: [
        seerScannerAutomationField,
        autofixAutomatingTuningField,
        automatedRunStoppingPointField,
      ],
    },
  ];

  return (
    <Fragment>
      <Form
        key={preference?.automated_run_stopping_point ?? 'solution'}
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
        allowUndo
        initialData={{
          seerScannerAutomation: project.seerScannerAutomation ?? false,
          autofixAutomationTuning: project.autofixAutomationTuning ?? 'off',
          automated_run_stopping_point:
            preference?.automated_run_stopping_point ?? 'solution',
        }}
        onSubmitSuccess={handleSubmitSuccess}
        additionalFieldProps={{organization}}
      >
        <JsonForm
          forms={seerFormGroups}
          disabled={!canWriteProject}
          renderHeader={() => (
            <Fragment>
              <Alert type="info" system>
                {tct(
                  "Choose how Seer automates analysis of incoming issues. Automated scans and fixes are charged at the [link:standard billing rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend.[break][break]You can also [bulklink:configure automation for other projects].",
                  {
                    link: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
                    spendlink: (
                      <Link
                        to={getPricingDocsLinkForEventType(
                          DataCategoryExact.SEER_AUTOFIX
                        )}
                      />
                    ),
                    break: <br />,
                    bulklink: <Link to={`/settings/${organization.slug}/seer/`} />,
                  }
                )}
              </Alert>
              <ProjectPermissionAlert project={project} system />
            </Fragment>
          )}
        />
      </Form>
    </Fragment>
  );
}

function ProjectSeer({project}: ProjectSeerProps) {
  const organization = useOrganization();
  const {setupAcknowledgement, billing, isLoading} = useOrganizationSeerSetup();

  const needsSetup =
    !setupAcknowledgement.userHasAcknowledged ||
    !setupAcknowledgement.orgHasAcknowledged ||
    (!billing.hasAutofixQuota && organization.features.includes('seer-billing'));

  if (organization.hideAiFeatures) {
    return <NoAccess />;
  }

  if (isLoading) {
    return (
      <Fragment>
        <SentryDocumentTitle
          title={t('Project Seer Settings')}
          projectSlug={project.slug}
        />
        <Placeholder height="60px" />
        <br />
        <Placeholder height="200px" />
        <br />
        <Placeholder height="200px" />
      </Fragment>
    );
  }

  if (needsSetup) {
    return (
      <Fragment>
        <SentryDocumentTitle
          title={t('Project Seer Settings')}
          projectSlug={project.slug}
        />
        <AiSetupDataConsent />
      </Fragment>
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
          projectName: (
            <span
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(`\`${project.slug}\``),
              }}
            />
          ),
        })}
      />
      {organization.features.includes('trigger-autofix-on-issue-summary') && (
        <ProjectSeerGeneralForm project={project} />
      )}
      <AutofixRepositories project={project} />
    </Fragment>
  );
}

export default function ProjectSeerContainer({project}: ProjectSeerProps) {
  const organization = useOrganization();

  if (!organization.features.includes('autofix-seer-preferences')) {
    return (
      <FeatureDisabled
        features={['autofix-seer-preferences']}
        hideHelpToggle
        message={t('Autofix is not enabled for this organization.')}
        featureName={t('Autofix')}
      />
    );
  }

  return <ProjectSeer project={project} />;
}
