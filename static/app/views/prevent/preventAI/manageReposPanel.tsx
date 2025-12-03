import {Fragment} from 'react';

import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {Heading, Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import type {
  PreventAIConfig,
  PreventAIFeatureConfigsByName,
  Sensitivity,
} from 'sentry/types/prevent';
import {usePreventAIGitHubConfig} from 'sentry/views/prevent/preventAI/hooks/usePreventAIConfig';
import {useUpdatePreventAIFeature} from 'sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature';
import {getRepoNameWithoutOrg} from 'sentry/views/prevent/preventAI/utils';

export type ManageReposPanelProps = {
  collapsed: boolean;
  isEditingOrgDefaults: boolean;
  onClose: () => void;
  org: OrganizationIntegration;
  allRepos?: Repository[];
  onFocusRepoSelector?: () => void;
  repo?: Repository | null;
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
  const {enableFeature, isLoading, error: updateError} = useUpdatePreventAIFeature();

  const {
    data: githubConfigData,
    isPending: isLoadingConfig,
    isError: isConfigError,
  } = usePreventAIGitHubConfig({gitOrgName: org.name});

  if (isLoadingConfig) {
    return <LoadingIndicator />;
  }

  if (isConfigError || !githubConfigData) {
    return (
      <Alert type="error">
        {t(
          'There was an error loading the AI Code Review settings. Please reload the page to try again.'
        )}
      </Alert>
    );
  }

  // If organization is an empty object (Record<string, never>), use default_org_config
  const orgConfig =
    githubConfigData.organization && Object.keys(githubConfigData.organization).length > 0
      ? (githubConfigData.organization as PreventAIConfig)
      : githubConfigData.default_org_config;

  const githubRepoId = repo?.externalId;

  const {doesUseOrgDefaults, repoConfig} = isEditingOrgDefaults
    ? {doesUseOrgDefaults: true, repoConfig: orgConfig.org_defaults}
    : getRepoConfig(orgConfig, githubRepoId ?? '');

  const repoNamesWithOverrides = allRepos
    .filter(r => orgConfig.repo_overrides?.hasOwnProperty(r.externalId))
    .map(r => getRepoNameWithoutOrg(r.name));

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
          <Flex direction="column" gap="md">
            {isEditingOrgDefaults ? (
              <Flex direction="column" gap="md">
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
              </Flex>
            ) : (
              <Flex direction="column" gap="md">
                <Heading as="h3">{t('AI Code Review Repository Settings')}</Heading>
                <Text variant="muted" size="sm">
                  {tct(
                    'These settings apply to the selected [repoLink] repository. To switch, use the repository selector in the page header.',
                    {
                      repoLink: (
                        <ExternalLink href={`https://github.com/${repo?.name}`}>
                          {repo?.name}
                        </ExternalLink>
                      ),
                    }
                  )}
                </Text>
              </Flex>
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
            <Flex direction="column" border="muted" radius="md">
              <Flex background="secondary" padding="lg xl">
                <Text size="md">{t('Override Organization Defaults')}</Text>
              </Flex>
              <Flex
                padding="lg xl"
                align="center"
                justify="between"
                gap="xl"
                borderTop="muted"
              >
                <Text variant="muted" size="sm">
                  {t(
                    'When enabled, you can customize settings for this repository. When disabled, this repository will use the organization default settings.'
                  )}
                </Text>
                <Switch
                  size="lg"
                  checked={!doesUseOrgDefaults}
                  disabled={isLoading}
                  onChange={async () => {
                    await enableFeature({
                      feature: 'use_org_defaults',
                      gitOrgName: org.name,
                      originalConfig: orgConfig,
                      repoId: githubRepoId,
                      enabled: !doesUseOrgDefaults,
                    });
                  }}
                  aria-label="Override Organization Defaults"
                />
              </Flex>
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
                    disabled={isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)}
                    onChange={async () => {
                      const newValue = !repoConfig.vanilla.enabled;
                      await enableFeature({
                        feature: 'vanilla',
                        enabled: newValue,
                        gitOrgName: org.name,
                        originalConfig: orgConfig,
                        repoId: githubRepoId,
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
                            isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async option =>
                            await enableFeature({
                              feature: 'vanilla',
                              enabled: true,
                              gitOrgName: org.name,
                              originalConfig: orgConfig,
                              repoId: githubRepoId,
                              sensitivity: option.value,
                            })
                          }
                          aria-label="PR Review Sensitivity"
                          menuWidth={350}
                          data-test-id="pr-review-sensitivity-dropdown"
                        />
                      </FieldGroup>
                    </Flex>
                  </Flex>
                )}
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
                    disabled={isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)}
                    onChange={async () => {
                      const newValue = !repoConfig.bug_prediction.enabled;
                      await enableFeature({
                        feature: 'bug_prediction',
                        enabled: newValue,
                        gitOrgName: org.name,
                        originalConfig: orgConfig,
                        repoId: githubRepoId,
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
                            isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async option =>
                            await enableFeature({
                              feature: 'bug_prediction',
                              enabled: true,
                              gitOrgName: org.name,
                              originalConfig: orgConfig,
                              repoId: githubRepoId,
                              sensitivity: option.value,
                            })
                          }
                          aria-label="Error Prediction Sensitivity"
                          menuWidth={350}
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
                            isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async () => {
                            const newValue =
                              !repoConfig.bug_prediction.triggers.on_ready_for_review;
                            await enableFeature({
                              feature: 'bug_prediction',
                              trigger: {on_ready_for_review: newValue},
                              enabled: true,
                              gitOrgName: org.name,
                              originalConfig: orgConfig,
                              repoId: githubRepoId,
                            });
                          }}
                          aria-label="Auto Run on Opened Pull Requests"
                        />
                      </FieldGroup>
                      <FieldGroup
                        label={<Text size="md">{t('Auto Run on New Commits')}</Text>}
                        help={
                          <Text size="xs" variant="muted">
                            {t('Run when new commits are pushed to a PR.')}
                          </Text>
                        }
                        alignRight
                        flexibleControlStateSize
                      >
                        <Switch
                          size="lg"
                          checked={
                            repoConfig.bug_prediction.triggers.on_new_commit ?? false
                          }
                          disabled={
                            isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async () => {
                            const newValue =
                              !repoConfig.bug_prediction.triggers.on_new_commit;
                            await enableFeature({
                              feature: 'bug_prediction',
                              trigger: {on_new_commit: newValue},
                              enabled: true,
                              gitOrgName: org.name,
                              originalConfig: orgConfig,
                              repoId: githubRepoId,
                            });
                          }}
                          aria-label="Auto Run on New Commits"
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
                            isLoading || (!isEditingOrgDefaults && doesUseOrgDefaults)
                          }
                          onChange={async () => {
                            const newValue =
                              !repoConfig.bug_prediction.triggers.on_command_phrase;
                            await enableFeature({
                              feature: 'bug_prediction',
                              trigger: {on_command_phrase: newValue},
                              enabled: true,
                              gitOrgName: org.name,
                              originalConfig: orgConfig,
                              repoId: githubRepoId,
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
  orgConfig: PreventAIConfig,
  repoId: string
): GetRepoConfigResult {
  const repoConfig = orgConfig.repo_overrides?.[repoId];
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
