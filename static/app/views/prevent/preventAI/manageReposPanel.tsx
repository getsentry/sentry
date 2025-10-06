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
import {type PreventAIOrgConfig} from 'sentry/types/prevent';
import type {PreventAIFeatureConfigsByName, Sensitivity} from 'sentry/types/prevent';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdatePreventAIFeature} from 'sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature';

interface ManageReposPanelProps {
  collapsed: boolean;
  onClose: () => void;
  orgName: string;
  repoName: string;
}

interface SensitivityOption {
  details: string;
  label: string;
  value: Sensitivity;
}

const sensitivityOptions: SensitivityOption[] = [
  {value: 'low', label: 'Low', details: 'Post all potential issues for maximum breadth.'},
  {
    value: 'medium',
    label: 'Medium',
    details: 'Post likely issues for a balance of thoroughness and noise.',
  },
  {
    value: 'high',
    label: 'High',
    details: 'Post only major issues to highlight most impactful findings.',
  },
  {
    value: 'critical',
    label: 'Critical',
    details: 'Post only high-impact, high-sensitivity issues for maximum focus.',
  },
];

function ManageReposPanel({
  collapsed,
  onClose,
  orgName,
  repoName,
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
    organization.preventAiConfigGithub.github_organizations[orgName] ??
    organization.preventAiConfigGithub.default_org_config;

  const {doesUseOrgDefaults, repoConfig} = getRepoConfig(orgConfig, repoName);

  return (
    <SlideOverPanel
      collapsed={collapsed}
      slidePosition="right"
      ariaLabel="Settings Panel"
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
            <Heading as="h3">{t('AI Code Review Settings')}</Heading>
            <Text variant="muted" size="sm">
              {tct(
                'These settings apply to the selected [repoLink] repository. To switch, use the repository selector in the page header.',
                {
                  repoLink: (
                    <ExternalLink href={`https://github.com/${orgName}/${repoName}`}>
                      {repoName}
                    </ExternalLink>
                  ),
                }
              )}
            </Text>
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
        {doesUseOrgDefaults && (
          <Flex direction="column" padding="xl xl 0 xl">
            <Alert type="info">
              {t("This repository is using the organization's defaults")}
            </Alert>
          </Flex>
        )}
        <Flex direction="column" gap="xl" padding="2xl">
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
                <Text size="md">Enable PR Review</Text>
                <Text variant="muted" size="sm">
                  Run when @sentry review is commented on a PR.
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={repoConfig?.vanilla?.enabled}
                disabled={isLoading || !canEditSettings}
                onChange={async () => {
                  const newValue = !repoConfig?.vanilla?.enabled;
                  await enableFeature({
                    feature: 'vanilla',
                    enabled: newValue,
                    orgName,
                    repoName,
                  });
                }}
                aria-label="Enable PR Review"
              />
            </Flex>
            {repoConfig.vanilla.enabled && (
              <Flex paddingLeft="xl">
                <Flex direction="column" borderLeft="muted" paddingLeft="md" width="100%">
                  <FieldGroup
                    label={<Text size="md">{t('Sensitivity')}</Text>}
                    help={
                      <Text size="xs" variant="muted">
                        {t('Set the sensitivity level for PR review analysis.')}
                      </Text>
                    }
                    inline
                    flexibleControlStateSize
                  >
                    <CompactSelect
                      value={repoConfig.vanilla.sensitivity ?? 'medium'}
                      options={sensitivityOptions}
                      onChange={async option =>
                        await enableFeature({
                          feature: 'vanilla',
                          enabled: true,
                          orgName,
                          repoName,
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
                <Text size="md">Enable Test Generation</Text>
                <Text variant="muted" size="sm">
                  Run when @sentry generate-test is commented on a PR.
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={repoConfig.test_generation.enabled}
                disabled={isLoading || !canEditSettings}
                onChange={async () => {
                  const newValue = !repoConfig.test_generation.enabled;
                  await enableFeature({
                    feature: 'test_generation',
                    enabled: newValue,
                    orgName,
                    repoName,
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
                <Text size="md">Enable Error Prediction</Text>
                <Text variant="muted" size="sm">
                  Allow organization members to review potential bugs.
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={repoConfig.bug_prediction.enabled}
                disabled={isLoading || !canEditSettings}
                onChange={async () => {
                  const newValue = !repoConfig.bug_prediction.enabled;
                  await enableFeature({
                    feature: 'bug_prediction',
                    enabled: newValue,
                    orgName,
                    repoName,
                  });
                }}
                aria-label="Enable Error Prediction"
              />
            </Flex>
            {repoConfig.bug_prediction.enabled && (
              <Flex paddingLeft="xl">
                <Flex direction="column" borderLeft="muted" paddingLeft="md" width="100%">
                  <FieldGroup
                    label={<Text size="md">{t('Sensitivity')}</Text>}
                    help={
                      <Text size="xs" variant="muted">
                        {t('Set the sensitivity level for error prediction.')}
                      </Text>
                    }
                    inline
                    flexibleControlStateSize
                  >
                    <CompactSelect
                      value={repoConfig.bug_prediction.sensitivity ?? 'medium'}
                      options={sensitivityOptions}
                      onChange={async option =>
                        await enableFeature({
                          feature: 'bug_prediction',
                          enabled: true,
                          orgName,
                          repoName,
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
                    label={<Text size="md">{t('Auto Run on Opened Pull Requests')}</Text>}
                    help={
                      <Text size="xs" variant="muted">
                        {t('Run when a PR is published, ignoring new pushes.')}
                      </Text>
                    }
                    inline
                    flexibleControlStateSize
                  >
                    <Switch
                      size="lg"
                      checked={repoConfig.bug_prediction.triggers.on_ready_for_review}
                      disabled={isLoading || !canEditSettings}
                      onChange={async () => {
                        const newValue =
                          !repoConfig.bug_prediction.triggers.on_ready_for_review;
                        await enableFeature({
                          feature: 'bug_prediction',
                          trigger: {on_ready_for_review: newValue},
                          enabled: true,
                          orgName,
                          repoName,
                        });
                      }}
                      aria-label="Auto Run on Opened Pull Requests"
                    />
                  </FieldGroup>
                  <FieldGroup
                    label={<Text size="md">{t('Run When Mentioned')}</Text>}
                    help={
                      <Text size="xs" variant="muted">
                        {t('Run when @sentry review is commented on a PR')}
                      </Text>
                    }
                    inline
                    flexibleControlStateSize
                  >
                    <Switch
                      size="lg"
                      checked={repoConfig.bug_prediction.triggers.on_command_phrase}
                      disabled={isLoading || !canEditSettings}
                      onChange={async () => {
                        const newValue =
                          !repoConfig.bug_prediction.triggers.on_command_phrase;
                        await enableFeature({
                          feature: 'bug_prediction',
                          trigger: {on_command_phrase: newValue},
                          enabled: true,
                          orgName,
                          repoName,
                        });
                      }}
                      aria-label="Run When Mentioned"
                    />
                  </FieldGroup>
                </Flex>
              </Flex>
            )}
          </Flex>
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
  repoName: string
): GetRepoConfigResult {
  const repoConfig = orgConfig.repo_overrides[repoName];
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
