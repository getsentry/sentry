import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
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
import {SEER_THRESHOLD_OPTIONS} from './constants';

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
  label: t('Scan Issues'),
  help: () =>
    t(
      'Seer will scan all new and ongoing issues in your project, flagging the most actionable issues, giving more context in Slack alerts, and enabling Issue Fixes to be triggered automatically.'
    ),
  type: 'boolean',
  saveOnBlur: true,
} satisfies FieldObject;

export const autofixAutomatingTuningField = {
  name: 'autofixAutomationTuning',
  label: t('Auto-Trigger Fixes'),
  help: () =>
    t(
      'If Seer detects that an issue is actionable enough, it will automatically analyze it in the background. By the time you see it, the root cause and solution will already be there for you.'
    ),
  type: 'choice',
  options: SEER_THRESHOLD_OPTIONS.map(option => ({
    value: option.value,
    label: <SeerSelectLabel>{option.label}</SeerSelectLabel>,
    details: option.details,
  })),
  saveOnBlur: true,
  saveMessage: t('Automatic Seer settings updated'),
  visible: ({model}) => model?.getValue('seerScannerAutomation') === true,
} satisfies FieldObject;

function ProjectSeerGeneralForm({project}: ProjectSeerProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {preference} = useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const canWriteProject = hasEveryAccess(['project:read'], {organization, project});

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
    label: t('Stopping Point for Auto-Triggered Fixes'),
    help: () =>
      t(
        'Choose how far Seer should go before stopping for your approval. This does not affect Issue Fixes that you manually start.'
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
      title: (
        <div>
          {t('Automation')}
          <Subheading>
            {tct(
              "Choose how Seer automatically triages and root-causes incoming issues, before you even notice them. This analysis is billed at the [link:standard rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend. You can also [bulklink:configure automation for other projects].",
              {
                link: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
                spendlink: (
                  <Link
                    to={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)}
                  />
                ),
                bulklink: <Link to={`/settings/${organization.slug}/seer/`} />,
              }
            )}
          </Subheading>
        </div>
      ),
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
              {!canWriteProject && <ProjectPermissionAlert project={project} system />}
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

const Subheading = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  text-transform: none;
  margin-top: ${space(1)};
  line-height: 1.4;
`;
