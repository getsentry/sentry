import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {Heading, Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {usePreventAIConfig} from 'sentry/views/prevent/preventAI/hooks/usePreventAIConfig';
import {useUpdatePreventAIFeature} from 'sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature';

interface ManageReposPanelProps {
  collapsed: boolean;
  onClose: () => void;
  orgName: string;
  repoName: string;
}

function ManageReposPanel({
  collapsed,
  onClose,
  orgName,
  repoName,
}: ManageReposPanelProps) {
  const {
    data: config,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = usePreventAIConfig(orgName, repoName);
  const {
    enableFeature,
    isLoading: updateLoading,
    error: updateError,
  } = useUpdatePreventAIFeature(orgName, repoName);

  const isLoading = configLoading || updateLoading;

  useEffect(() => {
    if (orgName && repoName) {
      refetchConfig();
    }
  }, [orgName, repoName, refetchConfig]);

  const isEnabledVanillaPrReview = config?.features?.vanilla?.enabled ?? false;
  const isEnabledTestGeneration = config?.features?.test_generation?.enabled ?? false;
  const isEnabledBugPrediction = config?.features?.bug_prediction?.enabled ?? false;

  const isEnabledBugPredictionOnCommandPhrase =
    config?.features?.bug_prediction?.triggers?.on_command_phrase ?? false;
  const isEnabledBugPredictionOnReadyForReview =
    config?.features?.bug_prediction?.triggers?.on_ready_for_review ?? false;

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
        <Flex direction="column" gap="xl" padding="2xl">
          {/* PR Review Feature */}
          <Flex direction="column">
            <FeatureSectionTop>
              <Flex direction="column" gap="sm">
                <Text size="md">Enable PR Review</Text>
                <Text variant="muted" size="sm">
                  Run when @sentry review is commented on a PR.
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={isEnabledVanillaPrReview}
                disabled={isLoading}
                onChange={async () => {
                  const newValue = !isEnabledVanillaPrReview;
                  await enableFeature({
                    feature: 'vanilla',
                    enabled: newValue,
                  });
                  refetchConfig();
                }}
                aria-label="Enable PR Review"
              />
            </FeatureSectionTop>
          </Flex>

          {/* Test Generation Feature */}
          <Flex direction="column">
            <FeatureSectionTop>
              <Flex direction="column" gap="sm">
                <Text size="md">Enable Test Generation</Text>
                <Text variant="muted" size="sm">
                  Run when @sentry generate-test is commented on a PR.
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={isEnabledTestGeneration}
                disabled={isLoading}
                onChange={async () => {
                  const newValue = !isEnabledTestGeneration;
                  await enableFeature({
                    feature: 'test_generation',
                    enabled: newValue,
                  });
                  refetchConfig();
                }}
                aria-label="Enable Test Generation"
              />
            </FeatureSectionTop>
          </Flex>

          {/* Error Prediction Feature with SubItems */}
          <Flex direction="column">
            <FeatureSectionTop>
              <Flex direction="column" gap="sm">
                <Text size="md">Enable Error Prediction</Text>
                <Text variant="muted" size="sm">
                  Allow organization members to review potential bugs.
                </Text>
              </Flex>
              <Switch
                size="lg"
                checked={isEnabledBugPrediction}
                disabled={isLoading}
                onChange={async () => {
                  const newValue = !isEnabledBugPrediction;
                  await enableFeature({
                    feature: 'bug_prediction',
                    enabled: newValue,
                    triggers: newValue
                      ? {
                          on_ready_for_review: true,
                          on_command_phrase: false,
                        }
                      : {
                          on_ready_for_review: false,
                          on_command_phrase: false,
                        },
                  });
                  refetchConfig();
                }}
                aria-label="Enable Error Prediction"
              />
            </FeatureSectionTop>
            {isEnabledBugPrediction && (
              <FeatureSectionSubItemContainer>
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
                    checked={isEnabledBugPredictionOnReadyForReview}
                    disabled={isLoading}
                    onChange={async () => {
                      const newValue = !isEnabledBugPredictionOnReadyForReview;
                      const newTriggers = {
                        on_ready_for_review: newValue,
                        on_command_phrase: isEnabledBugPredictionOnCommandPhrase,
                      };
                      await enableFeature({
                        feature: 'bug_prediction',
                        enabled: isEnabledBugPrediction,
                        triggers: newTriggers,
                      });
                      refetchConfig();
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
                    checked={isEnabledBugPredictionOnCommandPhrase}
                    disabled={isLoading}
                    onChange={async () => {
                      const newValue = !isEnabledBugPredictionOnCommandPhrase;
                      const newTriggers = {
                        on_ready_for_review: isEnabledBugPredictionOnReadyForReview,
                        on_command_phrase: newValue,
                      };
                      await enableFeature({
                        feature: 'bug_prediction',
                        enabled: isEnabledBugPrediction,
                        triggers: newTriggers,
                      });
                      refetchConfig();
                    }}
                    aria-label="Run When Mentioned"
                  />
                </FieldGroup>
              </FeatureSectionSubItemContainer>
            )}
          </Flex>
        </Flex>
      </Flex>
    </SlideOverPanel>
  );
}

const FeatureSectionTop = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-radius: 6px;
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

// width 150% because FieldGroup > FieldDescription has fixed width 50%
const FeatureSectionSubItemContainer = styled(Flex)`
  flex-direction: column;
  margin-left: ${p => p.theme.space.xl};
  border-left: 2px solid ${p => p.theme.border};
  padding-left: ${p => p.theme.space.md};
  width: 150%;
`;

export default ManageReposPanel;
