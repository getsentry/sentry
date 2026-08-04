import {Fragment, useCallback, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {ClaudeCodeIntegrationCta} from 'sentry/components/events/autofix/claudeCodeIntegrationCta';
import {CursorIntegrationCta} from 'sentry/components/events/autofix/cursorIntegrationCta';
import {GithubCopilotIntegrationCta} from 'sentry/components/events/autofix/githubCopilotIntegrationCta';
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {ExternalLink} from 'sentry/components/links/externalLink';
import {NoAccess} from 'sentry/components/noAccess';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {Placeholder} from 'sentry/components/placeholder';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {SEER_THRESHOLD_OPTIONS} from 'sentry/components/seer/legacy/constants';
import {AutofixRepositoriesList} from 'sentry/components/seer/projectDetails/autofixRepositoriesList';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUpdateProjectMutationOptions} from 'sentry/utils/project/useUpdateProject';
import {knownAgentIntegrationsQueryOptions} from 'sentry/utils/seer/preferredAgent';
import {
  getInfiniteSeerProjectsSettingsQueryOptions,
  getMutateSeerProjectSettingsOptions,
} from 'sentry/utils/seer/seerProjectSettings';
import type {
  AgentIntegration,
  AutofixAgentSelectOption,
  SeerProjectSettingResponse,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const AiSetupDataConsent = OverrideOrDefault({
  overrideName: 'component:ai-setup-data-consent',
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
  margin-bottom: ${p => p.theme.space.xs};
`;

const seerScannerAutomationSchema = z.object({
  seerScannerAutomation: z.boolean(),
});

const autofixAutomationTuningSchema = z.object({
  autofixAutomationTuning: z.enum(SEER_THRESHOLD_MAP),
});

type StoppingPointFieldValue =
  | 'root_cause'
  | 'solution'
  | 'code_changes'
  | 'open_pr'
  | 'cursor_handoff'
  | 'claude_handoff';

type StoppingPointOption = {
  details: string;
  label: ReactNode;
  value: StoppingPointFieldValue;
};

const stoppingPointSchema = z.object({
  automated_run_stopping_point: z.enum([
    'root_cause',
    'solution',
    'code_changes',
    'open_pr',
    'cursor_handoff',
    'claude_handoff',
  ]),
});

const autoCreatePrSchema = z.object({
  auto_create_pr: z.boolean(),
});

const integrationIdSchema = z.object({
  integration_id: z.string(),
});

function CodingAgentSettings({
  setting,
  handleAutoCreatePrChange,
  handleIntegrationChange,
  isKnownAgentsPending,
  canWriteProject,
  isAutomationOn,
  codingAgentIntegrations,
}: {
  canWriteProject: boolean;
  codingAgentIntegrations: AgentIntegration[];
  handleAutoCreatePrChange: (value: boolean) => Promise<unknown>;
  handleIntegrationChange: (integrationId: number) => Promise<unknown>;
  isKnownAgentsPending: boolean;
  setting: SeerProjectSettingResponse | undefined;
  isAutomationOn?: boolean;
}) {
  if (!setting || setting.agent === 'seer' || !isAutomationOn) {
    return null;
  }

  const autoCreatePrValue = setting.autoCreatePr ?? false;
  const selectedIntegrationId = setting.integrationId;
  const target = setting.agent;

  const isClaude = target === CodingAgentProvider.CLAUDE_CODE_AGENT;
  const agentName = isClaude ? t('Claude') : t('Cursor Cloud Agent');
  const sectionTitle = isClaude ? t('Claude Agent Settings') : t('Cursor Agent Settings');

  const integrationOptions = codingAgentIntegrations.map(integration => ({
    value: String(integration.id),
    label: `${integration.name} (${integration.id})`,
  }));

  const fieldDisabled = !canWriteProject || isKnownAgentsPending;

  return (
    <FieldGroup title={sectionTitle}>
      {/* Only show integration selector if there are multiple integrations */}
      {codingAgentIntegrations.length > 1 ? (
        <AutoSaveForm
          name="integration_id"
          schema={integrationIdSchema}
          initialValue={String(selectedIntegrationId)}
          mutationOptions={{
            mutationFn: (data: {integration_id: string}) =>
              handleIntegrationChange(parseInt(data.integration_id, 10)),
          }}
        >
          {field => (
            <field.Layout.Row
              label={t('Select Configuration')}
              hintText={t(
                'You have multiple configurations installed. Select which one to use for hand off.'
              )}
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={integrationOptions}
                disabled={fieldDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      ) : null}

      <AutoSaveForm
        name="auto_create_pr"
        schema={autoCreatePrSchema}
        initialValue={autoCreatePrValue}
        mutationOptions={{
          mutationFn: (data: {auto_create_pr: boolean}) =>
            handleAutoCreatePrChange(data.auto_create_pr),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Auto-Create Pull Requests')}
            hintText={t(
              'When enabled, %s will automatically create pull requests after hand off.',
              agentName
            )}
          >
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={fieldDisabled}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}

function ProjectSeerGeneralForm({project}: {project: DetailedProject}) {
  const organization = useOrganization();
  const user = useUser();
  const queryClient = useQueryClient();
  const {data: projectSettings} = useInfiniteQuery(
    infiniteQueryOptions({
      ...getInfiniteSeerProjectsSettingsQueryOptions({
        organization,
        query: {query: new MutableSearch(`id:${project.id}`)},
      }),
      select: ({pages}) => pages.flatMap(page => page.json),
    })
  );
  const setting = projectSettings?.find(s => s.projectSlug === project.slug);

  const {data: knownAgents, isPending: isKnownAgentsPending} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );
  const {mutateAsync: updateSeerSettings} = useMutation(
    getMutateSeerProjectSettingsOptions({
      organization,
      project,
      queryClient,
      knownAgents,
    })
  );

  const canWriteProject = hasEveryAccess(['project:read'], {organization, project});

  const cursorIntegrations =
    knownAgents?.filter(
      i => i.provider === CodingAgentProvider.CURSOR_BACKGROUND_AGENT
    ) ?? [];

  // For backwards compatibility, use the first cursor integration as default
  const cursorIntegration = cursorIntegrations[0];

  const claudeIntegrations =
    knownAgents?.filter(i => i.provider === CodingAgentProvider.CLAUDE_CODE_AGENT) ?? [];

  const claudeIntegration = claudeIntegrations[0];

  const scannerAutomation = project.seerScannerAutomation ?? false;
  const automationTuning = project.autofixAutomationTuning ?? 'off';

  const hasCursorIntegration = Boolean(cursorIntegration);

  const hasClaudeIntegration = Boolean(claudeIntegration);

  const handleStoppingPointChange = useCallback(
    (value: StoppingPointFieldValue) => {
      if (value === 'cursor_handoff') {
        if (!cursorIntegration?.id) {
          throw new Error('Cursor integration not found');
        }
        trackAnalytics('coding_integration.setup_handoff_clicked', {
          organization,
          project_slug: project.slug,
          provider: 'cursor',
          source: 'settings_dropdown',
          user_id: user.id,
        });
        return updateSeerSettings({
          agentOption:
            `${CodingAgentProvider.CURSOR_BACKGROUND_AGENT}::${cursorIntegration.id}` as AutofixAgentSelectOption,
          stoppingPoint: 'root_cause',
          autoCreatePr: false,
        });
      }
      if (value === 'claude_handoff') {
        if (!claudeIntegration?.id) {
          throw new Error('Claude integration not found');
        }
        trackAnalytics('coding_integration.setup_handoff_clicked', {
          organization,
          project_slug: project.slug,
          provider: 'claude_code',
          source: 'settings_dropdown',
          user_id: user.id,
        });
        return updateSeerSettings({
          agentOption:
            `${CodingAgentProvider.CLAUDE_CODE_AGENT}::${claudeIntegration.id}` as AutofixAgentSelectOption,
          stoppingPoint: 'root_cause',
          autoCreatePr: false,
        });
      }
      return updateSeerSettings({
        agentOption: 'seer',
        stoppingPoint: value,
      });
    },
    [
      organization,
      project.slug,
      user.id,
      updateSeerSettings,
      cursorIntegration,
      claudeIntegration,
    ]
  );

  const handleAutoCreatePrChange = useCallback(
    (value: boolean) => {
      if (!setting || setting.agent === 'seer') {
        return Promise.resolve();
      }
      return updateSeerSettings({
        agentOption:
          `${setting.agent}::${setting.integrationId}` as AutofixAgentSelectOption,
        autoCreatePr: value,
      });
    },
    [setting, updateSeerSettings]
  );

  const handleIntegrationChange = useCallback(
    (integrationId: number) => {
      if (!setting || setting.agent === 'seer') {
        return Promise.resolve();
      }
      return updateSeerSettings({
        agentOption: `${setting.agent}::${integrationId}` as AutofixAgentSelectOption,
        autoCreatePr: setting.autoCreatePr ?? false,
      });
    },
    [setting, updateSeerSettings]
  );

  const projectMutationOptions = useUpdateProjectMutationOptions(project);
  const updateProject = useMutation(projectMutationOptions);

  // The form's stopping-point field has no "off" option, so fall back to
  // "root_cause" when Seer isn't handing off to a coding agent.
  const automatedRunStoppingPoint =
    setting && setting.stoppingPoint !== 'off' ? setting.stoppingPoint : 'root_cause';

  const stoppingPointInitialValue =
    setting && setting.agent !== 'seer'
      ? setting.agent === CodingAgentProvider.CLAUDE_CODE_AGENT
        ? 'claude_handoff'
        : 'cursor_handoff'
      : automatedRunStoppingPoint;

  const cursorHandoffOption: StoppingPointOption[] = hasCursorIntegration
    ? [
        {
          value: 'cursor_handoff',
          label: <SeerSelectLabel>{t('Hand off to Cursor Cloud Agent')}</SeerSelectLabel>,
          details: t(
            "Seer will identify the root cause and hand off the fix to Cursor's cloud agent."
          ),
        },
      ]
    : [];

  const claudeHandoffOption: StoppingPointOption[] = hasClaudeIntegration
    ? [
        {
          value: 'claude_handoff',
          label: <SeerSelectLabel>{t('Hand off to Claude Agent')}</SeerSelectLabel>,
          details: t('Seer will identify the root cause and hand off the fix to Claude.'),
        },
      ]
    : [];

  const stoppingPointOptions: StoppingPointOption[] = [
    {
      value: 'root_cause',
      label: <SeerSelectLabel>{t('Root Cause (default)')}</SeerSelectLabel>,
      details: t('Seer will stop after identifying the root cause.'),
    },
    ...cursorHandoffOption,
    ...claudeHandoffOption,
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
  ];

  const tuningOptions = SEER_THRESHOLD_OPTIONS.map(option => ({
    value: option.value,
    label: <SeerSelectLabel>{option.label}</SeerSelectLabel>,
    details: option.details,
  }));

  return (
    <Fragment>
      {!canWriteProject && <ProjectPermissionAlert project={project} system />}
      <FieldGroup
        title={
          <Stack gap="md">
            {t('Automation')}
            <Text size="sm" variant="muted" density="comfortable">
              {tct(
                "Choose how Seer automatically triages and diagnoses incoming issues, before you even notice them. This analysis is billed at the [link:standard rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/pricing/#seer-pricing" />
                  ),
                  spendlink: (
                    <ExternalLink
                      href={getPricingDocsLinkForEventType(
                        DataCategoryExact.SEER_AUTOFIX
                      )}
                    />
                  ),
                  bulklink: <Link to={`/settings/${organization.slug}/seer/`} />,
                }
              )}
            </Text>
          </Stack>
        }
      >
        <AutoSaveForm
          name="seerScannerAutomation"
          schema={seerScannerAutomationSchema}
          initialValue={scannerAutomation}
          mutationOptions={projectMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Scan Issues')}
              hintText={t(
                'Seer will scan all new and ongoing issues in your project, flagging the most actionable issues, giving more context in Slack alerts, and enabling Issue Fixes to be triggered automatically.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!canWriteProject}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        {scannerAutomation ? (
          <AutoSaveForm
            name="autofixAutomationTuning"
            schema={autofixAutomationTuningSchema}
            initialValue={automationTuning}
            mutationOptions={{
              mutationFn: (data: {
                autofixAutomationTuning: DetailedProject['autofixAutomationTuning'];
              }) => updateProject.mutateAsync(data),
              onSuccess: () => {
                addSuccessMessage(t('Automatic Seer settings updated'));
              },
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Auto-Trigger Fixes')}
                hintText={t(
                  'If Seer detects that an issue is actionable enough, it will automatically analyze it in the background. By the time you see it, the root cause and solution will already be there for you.'
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={tuningOptions}
                  disabled={!canWriteProject}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        ) : null}

        {scannerAutomation && automationTuning !== 'off' ? (
          <AutoSaveForm
            name="automated_run_stopping_point"
            schema={stoppingPointSchema}
            initialValue={stoppingPointInitialValue}
            mutationOptions={{
              mutationFn: (data: {
                automated_run_stopping_point: StoppingPointFieldValue;
              }) => handleStoppingPointChange(data.automated_run_stopping_point),
              onSuccess: () => {
                addSuccessMessage(t('Stopping point updated'));
              },
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Where should Seer stop?')}
                hintText={t(
                  'Choose how far Seer should go during automated runs before stopping for your approval. This does not affect Issue Fixes that you manually start.'
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={stoppingPointOptions}
                  disabled={!canWriteProject || isKnownAgentsPending}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        ) : null}
      </FieldGroup>
      <CodingAgentSettings
        setting={setting}
        isKnownAgentsPending={isKnownAgentsPending}
        handleAutoCreatePrChange={handleAutoCreatePrChange}
        isAutomationOn={automationTuning !== 'off'}
        handleIntegrationChange={handleIntegrationChange}
        canWriteProject={canWriteProject}
        codingAgentIntegrations={
          setting?.agent === CodingAgentProvider.CLAUDE_CODE_AGENT
            ? claudeIntegrations
            : cursorIntegrations
        }
      />
    </Fragment>
  );
}

function ProjectSeer({
  organization,
  project,
}: {
  organization: Organization;
  project: DetailedProject;
}) {
  const {billing, isLoading} = useOrganizationSeerSetup();

  const needsSetup =
    !billing.hasAutofixQuota && organization.features.includes('seer-billing');

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
      <CursorIntegrationCta project={project} />
      <ClaudeCodeIntegrationCta project={project} />
      <GithubCopilotIntegrationCta />
      <AutofixRepositoriesList canWrite includeInstructions project={project} />
      <Flex justify="center" marginTop="lg">
        <LinkButton
          to={`/settings/${organization.slug}/seer/onboarding/`}
          variant="primary"
        >
          {t('Set up my other projects')}
        </LinkButton>
      </Flex>
    </Fragment>
  );
}

export function ProjectSeerContainer() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  return <ProjectSeer organization={organization} project={project} />;
}
