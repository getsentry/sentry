import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {hasEveryAccess} from 'sentry/components/acl/access';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {CursorIntegrationCta} from 'sentry/components/events/autofix/cursorIntegrationCta';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
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
import {singleLineRenderer} from 'sentry/utils/marked/marked';
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

const autofixAutomationToggleField = {
  name: 'autofixAutomationTuning',
  label: t('Auto-Trigger Fixes'),
  help: () =>
    t(
      'When enabled, Seer will automatically analyze actionable issues in the background.'
    ),
  type: 'boolean',
  saveOnBlur: true,
  saveMessage: t('Automatic Seer settings updated'),
  // For triage signals V0: toggle ON maps to 'medium' threshold (fixability >= 0.40)
  getData: (data: Record<PropertyKey, unknown>) => ({
    autofixAutomationTuning: data.autofixAutomationTuning ? 'medium' : 'off',
  }),
} satisfies FieldObject;

function CodingAgentSettings({
  preference,
  handleAutoCreatePrChange,
  canWriteProject,
  isAutomationOn,
}: {
  canWriteProject: boolean;
  handleAutoCreatePrChange: (value: boolean) => void;
  preference: ProjectSeerPreferences | null | undefined;
  isAutomationOn?: boolean;
}) {
  if (!preference?.automation_handoff || !isAutomationOn) {
    return null;
  }

  const initialValue = preference?.automation_handoff?.auto_create_pr ?? false;

  return (
    <Form
      key={`coding-agent-settings-${initialValue}`}
      apiMethod="POST"
      saveOnBlur
      initialData={{
        auto_create_pr: initialValue,
      }}
    >
      <JsonForm
        forms={[
          {
            title: t('Cursor Agent Settings'),
            fields: [
              {
                name: 'auto_create_pr',
                label: t('Auto-Create Pull Requests'),
                help: t(
                  'When enabled, Cursor Cloud Agents will automatically create pull requests after hand off.'
                ),
                saveOnBlur: true,
                type: 'boolean',
                getData: () => ({}),
                getValue: () => initialValue,
                disabled: !canWriteProject,
                onChange: handleAutoCreatePrChange,
              } satisfies FieldObject,
            ],
          },
        ]}
      />
    </Form>
  );
}

function ProjectSeerGeneralForm({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {preference} = useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);
  const {data: codingAgentIntegrations} = useCodingAgentIntegrations();

  const isTriageSignalsFeatureOn = project.features.includes('triage-signals-v0');
  const canWriteProject = hasEveryAccess(['project:read'], {organization, project});

  const cursorIntegration = codingAgentIntegrations?.integrations.find(
    integration => integration.provider === 'cursor'
  );

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

  const hasCursorIntegration = Boolean(
    organization.features.includes('integrations-cursor') && cursorIntegration
  );

  const handleStoppingPointChange = useCallback(
    (
      value: 'root_cause' | 'solution' | 'code_changes' | 'open_pr' | 'cursor_handoff'
    ) => {
      if (value === 'cursor_handoff') {
        if (!cursorIntegration) {
          throw new Error('Cursor integration not found');
        }
        updateProjectSeerPreferences({
          repositories: preference?.repositories || [],
          automated_run_stopping_point: 'root_cause',
          automation_handoff: {
            handoff_point: 'root_cause',
            target: 'cursor_background_agent',
            integration_id: parseInt(cursorIntegration.id, 10),
            auto_create_pr: false,
          },
        });
      } else {
        updateProjectSeerPreferences({
          repositories: preference?.repositories || [],
          automated_run_stopping_point: value,
          automation_handoff: undefined,
        });
      }
    },
    [updateProjectSeerPreferences, preference?.repositories, cursorIntegration]
  );

  const handleAutoCreatePrChange = useCallback(
    (value: boolean) => {
      if (!preference?.automation_handoff) {
        return;
      }
      updateProjectSeerPreferences({
        repositories: preference?.repositories || [],
        automated_run_stopping_point: preference?.automated_run_stopping_point,
        automation_handoff: {
          ...preference.automation_handoff,
          auto_create_pr: value,
        },
      });
    },
    [preference, updateProjectSeerPreferences]
  );

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
      ...(hasCursorIntegration
        ? [
            {
              value: 'cursor_handoff',
              label: (
                <SeerSelectLabel>{t('Hand off to Cursor Cloud Agent')}</SeerSelectLabel>
              ),
              details: t(
                "Seer will identify the root cause and hand off the fix to Cursor's cloud agent."
              ),
            },
          ]
        : []),
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
      // Handle both boolean (toggle) and string (dropdown) values
      const automationEnabled =
        typeof tuningValue === 'boolean' ? tuningValue : tuningValue !== 'off';

      // When feature flag is ON (toggle mode): only check automation
      // When feature flag is OFF (dropdown mode): check both scanner and automation
      if (isTriageSignalsFeatureOn) {
        return automationEnabled;
      }

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
        ...(isTriageSignalsFeatureOn ? [] : [seerScannerAutomationField]),
        isTriageSignalsFeatureOn
          ? autofixAutomationToggleField
          : autofixAutomatingTuningField,
        automatedRunStoppingPointField,
      ],
    },
  ];

  const automationTuning = isTriageSignalsFeatureOn
    ? (project.autofixAutomationTuning ?? 'off') !== 'off'
    : (project.autofixAutomationTuning ?? 'off');

  return (
    <Fragment>
      <Form
        key={`${project.seerScannerAutomation}-${project.autofixAutomationTuning}-${
          preference?.automation_handoff
            ? 'cursor_handoff'
            : (preference?.automated_run_stopping_point ?? 'root_cause')
        }-${isTriageSignalsFeatureOn}`}
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
        allowUndo
        initialData={{
          seerScannerAutomation: project.seerScannerAutomation ?? false,
          // Same DB field, different UI: toggle (boolean) vs dropdown (string)
          autofixAutomationTuning: automationTuning,
          automated_run_stopping_point: preference?.automation_handoff
            ? 'cursor_handoff'
            : (preference?.automated_run_stopping_point ?? 'root_cause'),
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
      <CodingAgentSettings
        preference={preference}
        handleAutoCreatePrChange={handleAutoCreatePrChange}
        isAutomationOn={automationTuning && automationTuning !== 'off'}
        canWriteProject={canWriteProject}
      />
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
          projectName: (
            <span
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(`\`${project.slug}\``),
              }}
            />
          ),
        })}
      />
      <ProjectSeerGeneralForm project={project} />
      <CursorIntegrationCta project={project} />
      <AutofixRepositories project={project} />
      <Center>
        <LinkButton
          to={`/settings/${organization.slug}/seer/onboarding/`}
          priority="primary"
        >
          {t('Set up my other projects')}
        </LinkButton>
      </Center>
    </Fragment>
  );
}

export default function ProjectSeerContainer() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

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

  return <ProjectSeer organization={organization} project={project} />;
}

const Subheading = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  text-transform: none;
  margin-top: ${space(1)};
  line-height: 1.4;
`;

const Center = styled('div')`
  display: flex;
  justify-content: center;
  margin-top: ${p => p.theme.space.lg};
`;
