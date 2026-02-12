import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {GithubCopilotIntegrationCta} from 'sentry/components/events/autofix/githubCopilotIntegrationCta';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {
  useCodingAgentIntegrations,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import {NoAccess} from 'sentry/components/noAccess';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {AutofixRepositories} from './autofixRepositories';
import {SEER_THRESHOLD_OPTIONS} from './constants';

const AiSetupDataConsent = HookOrDefault({
  hookName: 'component:ai-setup-data-consent',
  defaultComponent: () => <div data-test-id="ai-setup-data-consent" />,
});

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

const SEER_OPTION_VALUE = '__seer__';

function ProjectSeerGeneralForm({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {preference} = useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);
  const {data: codingAgentIntegrations} = useCodingAgentIntegrations();

  const canWriteProject = hasEveryAccess(['project:read'], {organization, project});

  // Filter to org-installed automation-capable integrations (exclude per-user auth like Copilot)
  const automationIntegrations: CodingAgentIntegration[] = useMemo(
    () =>
      codingAgentIntegrations?.integrations.filter(
        integration => integration.provider === 'cursor' && !integration.requires_identity
      ) ?? [],
    [codingAgentIntegrations]
  );

  const handleSubmitSuccess = useCallback(
    (resp: Project) => {
      const projectSettingsQueryKey: ApiQueryKey = [
        getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/`, {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        }),
      ];
      setApiQueryData(queryClient, projectSettingsQueryKey, resp);
      ProjectsStore.onUpdateSuccess(resp);
    },
    [project.slug, queryClient, organization.slug]
  );

  const handleStoppingPointChange = useCallback(
    (value: 'root_cause' | 'solution' | 'code_changes' | 'open_pr') => {
      updateProjectSeerPreferences({
        repositories: preference?.repositories || [],
        automated_run_stopping_point: value,
        automation_handoff: preference?.automation_handoff,
      });
    },
    [
      updateProjectSeerPreferences,
      preference?.repositories,
      preference?.automation_handoff,
    ]
  );

  const handleCodingAgentChange = useCallback(
    (value: string) => {
      const isSeer = value === SEER_OPTION_VALUE;
      updateProjectSeerPreferences({
        repositories: preference?.repositories || [],
        automated_run_stopping_point: preference?.automated_run_stopping_point,
        automation_handoff: isSeer
          ? {
              handoff_point: 'root_cause',
              target: 'seer_coding_agent',
            }
          : {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: Number(value),
            },
      });
    },
    [
      updateProjectSeerPreferences,
      preference?.repositories,
      preference?.automated_run_stopping_point,
    ]
  );

  // Determine current coding agent value for form initialData
  const handoff = preference?.automation_handoff;
  let codingAgentValue = SEER_OPTION_VALUE;
  if (handoff?.target === 'cursor_background_agent' && handoff?.integration_id != null) {
    codingAgentValue = String(handoff.integration_id);
  }

  const codingAgentOptions = [
    {
      value: SEER_OPTION_VALUE,
      label: <SeerSelectLabel>{t('Seer (default)')}</SeerSelectLabel>,
      details: t("Seer's built-in coding agent will handle solutions and fixes."),
    },
    ...automationIntegrations.map(integration => ({
      value: String(integration.id),
      label: <SeerSelectLabel>{integration.name}</SeerSelectLabel>,
      details: t('Hand off to %s after root cause analysis.', integration.name),
    })),
  ];

  const automatedRunStoppingPointField = {
    name: 'automated_run_stopping_point',
    label: t('Where should Seer stop?'),
    help: () =>
      t(
        'Choose how far Seer should go during automated runs before stopping for your approval. This does not affect Issue Fixes that you manually start.'
      ),
    type: 'choice',
    options: [
      {
        value: 'root_cause',
        label: <SeerSelectLabel>{t('Root Cause (default)')}</SeerSelectLabel>,
        details: t('Seer will stop after identifying the root cause.'),
      },
      {
        value: 'solution',
        label: <SeerSelectLabel>{t('Solution')}</SeerSelectLabel>,
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
    getData: () => ({}),
    visible: ({model}) => {
      const tuningValue = model?.getValue('autofixAutomationTuning');
      const automationEnabled =
        typeof tuningValue === 'boolean' ? tuningValue : tuningValue !== 'off';

      const scannerEnabled = model?.getValue('seerScannerAutomation') === true;
      return scannerEnabled && automationEnabled;
    },
  } satisfies FieldObject;

  const codingAgentField = {
    name: 'codingAgent',
    label: t('Coding Agent'),
    help: () =>
      t(
        'Choose which coding agent handles solutions and fixes after root cause analysis.'
      ),
    type: 'choice',
    options: codingAgentOptions,
    saveOnBlur: true,
    saveMessage: t('Coding agent updated'),
    onChange: handleCodingAgentChange,
    getData: () => ({}),
    visible: ({model}) => {
      const tuningValue = model?.getValue('autofixAutomationTuning');
      const automationEnabled =
        typeof tuningValue === 'boolean' ? tuningValue : tuningValue !== 'off';

      const scannerEnabled = model?.getValue('seerScannerAutomation') === true;
      return scannerEnabled && automationEnabled;
    },
  } satisfies FieldObject;

  const seerFormGroups: JsonFormObject[] = [
    {
      title: (
        <div>
          {t('Automation')}
          <Subheading>
            {tct(
              "Choose how Seer automatically triages and diagnoses incoming issues, before you even notice them. This analysis is billed at the [link:standard rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/pricing/#seer-pricing" />
                ),
                spendlink: (
                  <ExternalLink
                    href={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)}
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
        codingAgentField,
      ],
    },
  ];

  const automationTuning = project.autofixAutomationTuning ?? 'off';

  return (
    <Fragment>
      <Form
        key={`${project.seerScannerAutomation}-${project.autofixAutomationTuning}-${
          preference?.automated_run_stopping_point ?? 'root_cause'
        }-${codingAgentValue}`}
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
        allowUndo
        initialData={{
          seerScannerAutomation: project.seerScannerAutomation ?? false,
          autofixAutomationTuning: automationTuning,
          automated_run_stopping_point:
            preference?.automated_run_stopping_point ?? 'root_cause',
          codingAgent: codingAgentValue,
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

function ProjectSeer({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}) {
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
          projectName: <code>{project.slug}</code>,
        })}
      />
      <ProjectSeerGeneralForm project={project} />
      <GithubCopilotIntegrationCta />
      <AutofixRepositories project={project} />
      <Flex justify="center" marginTop="lg">
        <LinkButton
          to={`/settings/${organization.slug}/seer/onboarding/`}
          priority="primary"
        >
          {t('Set up my other projects')}
        </LinkButton>
      </Flex>
    </Fragment>
  );
}

export default function ProjectSeerContainer() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  if (!organization.features.includes('autofix-seer-preferences')) {
    return (
      <FeatureDisabled
        features={['organizations:autofix-seer-preferences']}
        hideHelpToggle
        message={t('Autofix is not enabled for this organization.')}
        featureName={t('Autofix')}
      />
    );
  }

  return <ProjectSeer organization={organization} project={project} />;
}

const Subheading = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  text-transform: none;
  margin-top: ${space(1)};
  line-height: 1.4;
`;
