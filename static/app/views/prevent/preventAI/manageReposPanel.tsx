import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {Heading, Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {
  PreventAIFeatureConfigsByName,
  PreventAIOrg,
  PreventAIOrgConfig,
  PreventAIRepo,
  Sensitivity,
} from 'sentry/types/prevent';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdatePreventAIFeature} from 'sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature';

export type ManageReposPanelProps = {
  collapsed: boolean;
  isEditingOrgDefaults: boolean;
  onClose: () => void;
  org: PreventAIOrg;
  allRepos?: Array<{id: string; name: string}>;
  onFocusRepoSelector?: () => void;
  repo?: PreventAIRepo | null;
};

interface SensitivityOption {
  details: string;
  label: string;
  value: Sensitivity;
}

const sensitivityOptions: SensitivityOption[] = [
  {
    value: 'low',
    label: t('Low'),
    details: t('Post all potential issues for maximum breadth.'),
  },
  {
    value: 'medium',
    label: t('Medium'),
    details: t('Post likely issues for a balance of thoroughness and noise.'),
  },
  {
    value: 'high',
    label: t('High'),
    details: t('Post only major issues to highlight most impactful findings.'),
  },
  {
    value: 'critical',
    label: t('Critical'),
    details: t('Post only high-impact, high-sensitivity issues for maximum focus.'),
  },
];

function ManageReposPanel({
  collapsed,
  onClose,
  org,
  repo,
  allRepos = [],
  isEditingOrgDefaults,
}: ManageReposPanelProps) {
  const organization = useOrganization();
  const {enableFeature, isLoading, error: updateError} = useUpdatePreventAIFeature();

  const canEditSettings =
    organization.access.includes('org:write') ||
    organization.access.includes('org:admin');

  if (!organization.preventAiConfigGithub) {
    return (
      <Alert type="error">
        {t(
          'There was an error loading the AI Code Review settings. Please reload the page to try again.'
        )}
      </Alert>
    );
  }

  const orgConfig =
    organization.preventAiConfigGithub.github_organizations[org.githubOrganizationId] ??
    organization.preventAiConfigGithub.default_org_config;

  const {doesUseOrgDefaults, repoConfig} = isEditingOrgDefaults
    ? {doesUseOrgDefaults: true, repoConfig: orgConfig.org_defaults}
    : getRepoConfig(orgConfig, repo?.id ?? '');

  const repoNamesWithOverrides = allRepos
    .filter(r => orgConfig.repo_overrides?.hasOwnProperty(r.id))
    .map(r => r.name);

  return (
    <SlideOverPanel
      collapsed={collapsed}
      slidePosition="right"
      ariaLabel="Settings Panel"
      data-test-id="manage-repos-panel"
    >
      <Flex direction="column">
        <Flex
          align="center"
          justify="between"
          padding="xl 2xl"
          borderBottom="muted"
          background="secondary"
        >
          <Flex direction="column" gap="xs">
            {isEditingOrgDefaults ? (
              <Fragment>
                <Heading as="h3">{t('AI Code Review Default Settings')}</Heading>
                <Text variant="muted" size="sm">
                  {tct(
                    'These settings apply to all repositories by default. Individual repositories can override these defaults. The following repositories have custom settings applied: [reposWithOverrides]',
                    {
                      reposWithOverrides: (
                        <Text as="span" monospace>
                          {repoNamesWithOverrides.length > 0
                            ? repoNamesWithOverrides.join(',')
                            : '[none]'}
                        </Text>
                      ),
                    }
                  )}
                </Text>
              </Fragment>
            ) : (
              <Fragment>
                <Heading as="h3">{t('AI Code Review Repository Settings')}</Heading>
                <Text variant="muted" size="sm">
                  {tct(
                    'These settings apply to the selected [repoLink] repository. To switch, use the repository selector in the page header.',
                    {
                      repoLink: (
                        <ExternalLink
                          href={`https://github.com/${org.name}/${repo?.name}`}
                        >
                          {repo?.name}
                        </ExternalLink>
                      ),
                    }
                  )}
                </Text>
              </Fragment>
            )}
          </Flex>
          <Button
            priority="transparent"
            size="zero"
            borderless
            aria-label="Close Settings"
            icon={<IconClose />}
            onClick={onClose}
          >
            Close
          </Button>
        </Flex>
        {updateError && (
          <Alert type="error">{'Could not update settings. Please try again.'}</Alert>
        )}
        <Flex direction="column" gap="xl" padding="2xl">
          {/* Override Organization Defaults Toggle */}
          {!isEditingOrgDefaults && (
            <Flex
              border="muted"
              radius="md"
              padding="lg xl"
              align="center"
              justify="between"
            >
              <Flex direction="column" gap="sm">
                <Text size="md">{t('Override Organization Defaults')}</Text>
                <Text variant="muted" size="sm">
                  {t(
                    'When enabled, you can customize settings for this repository. When disabled, this repository will use the organization default settings.'
                  )}
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={!doesUseOrgDefaults}
                disabled={isLoading || !canEditSettings}
                onChange={async () => {
                  await enableFeature({
                    feature: 'use_org_defaults',
                    orgId: org.githubOrganizationId,
                    repoId: repo?.id,
                    enabled: !doesUseOrgDefaults,
                  });
                }}
                aria-label="Override Organization Defaults"
              />
            </Flex>
          )}
          {(isEditingOrgDefaults || !doesUseOrgDefaults) && (
            <Fragment>
              {/* PR Review Feature */}
              <Flex direction="column">
                <Flex
                  border="muted"
                  radius="md"
                  background="secondary"
                  padding="lg xl"
                  align="center"
                  justify="between"
                >
                  <Flex direction="column" gap="sm">
                    <Text size="md">{t('Enable PR Review')}</Text>
                    <Text variant="muted" size="sm">
                      {t('Run when @sentry review is commented on a PR.')}
                    </Text>
                  </Flex>
                  <Switch
                    size="lg"
                    checked={repoConfig.vanilla.enabled}
                    disabled={
                      isLoading ||
                      !canEditSettings ||
                      (!isEditingOrgDefaults && doesUseOrgDefaults)
                    }
                    onChange={async () => {
                      const newValue = !repoConfig.vanilla.enabled;
                      await enableFeature({
                        feature: 'vanilla',
                        enabled: newValue,
                        orgId: org.githubOrganizationId,
                        repoId: repo?.id,
                      });
                    }}
                    aria-label="Enable PR Review"
                  />
                </Flex>
                {repoConfig.vanilla.enabled && (
                  <Flex paddingLeft="xl" direction="column">
                    <Flex direction="column" borderLeft="muted" paddingLeft="md">
                      <FieldGroup
                        label={<Text size="md">{t('Sensitivity')}</Text>}
                        help={
                          <Text size="xs" variant="muted">
                            {t('Set the sensitivity level for PR review analysis.')}
                          </Text>
                        }
                        alignRight
                        flexibleControlStateSize
                      >
                        <CompactSelect
                          value={repoConfig.vanilla.sensitivity ?? 'medium'}
                          options={sensitivityOptions}
                          disabled={
                            isLoading ||
                            !canEditSettings ||
                            (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async option =>
                            await enableFeature({
                              feature: 'vanilla',
                              enabled: true,
                              orgId: org.githubOrganizationId,
                              repoId: repo?.id,
                              sensitivity: option.value,
                            })
                          }
                          aria-label="PR Review Sensitivity"
                          menuWidth={350}
                          maxMenuWidth={500}
                          data-test-id="pr-review-sensitivity-dropdown"
                        />
                      </FieldGroup>
                    </Flex>
                  </Flex>
                )}
              </Flex>

              {/* Test Generation Feature */}
              <Flex direction="column">
                <Flex
                  border="muted"
                  radius="md"
                  background="secondary"
                  padding="lg xl"
                  align="center"
                  justify="between"
                >
                  <Flex direction="column" gap="sm">
                    <Text size="md">{t('Enable Test Generation')}</Text>
                    <Text variant="muted" size="sm">
                      {t('Run when @sentry generate-test is commented on a PR.')}
                    </Text>
                  </Flex>
                  <Switch
                    size="lg"
                    checked={repoConfig.test_generation.enabled}
                    disabled={
                      isLoading ||
                      !canEditSettings ||
                      (!isEditingOrgDefaults && doesUseOrgDefaults)
                    }
                    onChange={async () => {
                      const newValue = !repoConfig.test_generation.enabled;
                      await enableFeature({
                        feature: 'test_generation',
                        enabled: newValue,
                        orgId: org.githubOrganizationId,
                        repoId: repo?.id,
                      });
                    }}
                    aria-label="Enable Test Generation"
                  />
                </Flex>
              </Flex>

              {/* Error Prediction Feature with SubItems */}
              <Flex direction="column">
                <Flex
                  border="muted"
                  radius="md"
                  background="secondary"
                  padding="lg xl"
                  align="center"
                  justify="between"
                >
                  <Flex direction="column" gap="sm">
                    <Text size="md">{t('Enable Error Prediction')}</Text>
                    <Text variant="muted" size="sm">
                      {t('Allow organization members to review potential bugs.')}
                    </Text>
                  </Flex>
                  <Switch
                    size="lg"
                    checked={repoConfig.bug_prediction.enabled}
                    disabled={
                      isLoading ||
                      !canEditSettings ||
                      (!isEditingOrgDefaults && doesUseOrgDefaults)
                    }
                    onChange={async () => {
                      const newValue = !repoConfig.bug_prediction.enabled;
                      await enableFeature({
                        feature: 'bug_prediction',
                        enabled: newValue,
                        orgId: org.githubOrganizationId,
                        repoId: repo?.id,
                      });
                    }}
                    aria-label="Enable Error Prediction"
                  />
                </Flex>
                {repoConfig.bug_prediction.enabled && (
                  <Flex paddingLeft="xl" direction="column">
                    <Flex direction="column" borderLeft="muted" paddingLeft="md">
                      <FieldGroup
                        label={<Text size="md">{t('Sensitivity')}</Text>}
                        help={
                          <Text size="xs" variant="muted">
                            {t('Set the sensitivity level for error prediction.')}
                          </Text>
                        }
                        alignRight
                        flexibleControlStateSize
                      >
                        <CompactSelect
                          value={repoConfig.bug_prediction.sensitivity ?? 'medium'}
                          options={sensitivityOptions}
                          disabled={
                            isLoading ||
                            !canEditSettings ||
                            (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async option =>
                            await enableFeature({
                              feature: 'bug_prediction',
                              enabled: true,
                              orgId: org.githubOrganizationId,
                              repoId: repo?.id,
                              sensitivity: option.value,
                            })
                          }
                          aria-label="Error Prediction Sensitivity"
                          menuWidth={350}
                          maxMenuWidth={500}
                          data-test-id="error-prediction-sensitivity-dropdown"
                        />
                      </FieldGroup>
                      <FieldGroup
                        label={
                          <Text size="md">{t('Auto Run on Opened Pull Requests')}</Text>
                        }
                        help={
                          <Text size="xs" variant="muted">
                            {t('Run when a PR is published, ignoring new pushes.')}
                          </Text>
                        }
                        alignRight
                        flexibleControlStateSize
                      >
                        <Switch
                          size="lg"
                          checked={repoConfig.bug_prediction.triggers.on_ready_for_review}
                          disabled={
                            isLoading ||
                            !canEditSettings ||
                            (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async () => {
                            const newValue =
                              !repoConfig.bug_prediction.triggers.on_ready_for_review;
                            await enableFeature({
                              feature: 'bug_prediction',
                              trigger: {on_ready_for_review: newValue},
                              enabled: true,
                              orgId: org.githubOrganizationId,
                              repoId: repo?.id,
                            });
                          }}
                          aria-label="Auto Run on Opened Pull Requests"
                        />
                      </FieldGroup>
                      <FieldGroup
                        label={<Text size="md">{t('Run When Mentioned')}</Text>}
                        help={
                          <Text size="xs" variant="muted">
                            {t('Run when @sentry review is commented on a PR.')}
                          </Text>
                        }
                        alignRight
                        flexibleControlStateSize
                      >
                        <Switch
                          size="lg"
                          checked={repoConfig.bug_prediction.triggers.on_command_phrase}
                          disabled={
                            isLoading ||
                            !canEditSettings ||
                            (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async () => {
                            const newValue =
                              !repoConfig.bug_prediction.triggers.on_command_phrase;
                            await enableFeature({
                              feature: 'bug_prediction',
                              trigger: {on_command_phrase: newValue},
                              enabled: true,
                              orgId: org.githubOrganizationId,
                              repoId: repo?.id,
                            });
                          }}
                          aria-label="Run When Mentioned"
                        />
                      </FieldGroup>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </Fragment>
          )}
        </Flex>
      </Flex>
    </SlideOverPanel>
  );
}

interface GetRepoConfigResult {
  doesUseOrgDefaults: boolean;
  repoConfig: PreventAIFeatureConfigsByName;
}

export function getRepoConfig(
  orgConfig: PreventAIOrgConfig,
  repoId: string
): GetRepoConfigResult {
  const repoConfig = orgConfig.repo_overrides[repoId];
  if (repoConfig) {
    return {
      doesUseOrgDefaults: false,
      repoConfig,
    };
  }

  return {
    doesUseOrgDefaults: true,
    repoConfig: orgConfig.org_defaults,
  };
}

export default ManageReposPanel;
