import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {Heading, Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {FieldDescription} from 'sentry/components/forms/fieldGroup/fieldDescription';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {usePreventAIConfig} from 'sentry/views/prevent/preventAI/hooks/usePreventAIConfig';
import {useUpdatePreventAIFeature} from 'sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature';
import type {Sensitivity, SensitivityOption} from 'sentry/views/prevent/preventAI/types';

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

  const sensitivityOptions: SensitivityOption[] = [
    {
      value: 'low',
      label: 'Low',
      details: 'Post all potential issues for maximum breadth.',
    },
    {
      value: 'medium',
      label: 'Medium',
      details: 'Post likely issues for a balance of thoroughness and noise',
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

  const DEFAULT_SENSITIVITY = 'medium';

  const [vanillaPrReviewSensitivity, setVanillaPrReviewSensitivity] = useState(
    config?.features?.vanilla?.sensitivity ?? DEFAULT_SENSITIVITY
  );
  const [bugPredictionSensitivity, setBugPredictionSensitivity] = useState(
    config?.features?.bug_prediction?.sensitivity ?? DEFAULT_SENSITIVITY
  );

  // Keep state in sync with config if it changes
  useEffect(() => {
    setVanillaPrReviewSensitivity(
      sensitivityOptions.some(opt => opt.value === config?.features?.vanilla?.sensitivity)
        ? config?.features?.vanilla?.sensitivity
        : DEFAULT_SENSITIVITY
    );
  }, [config?.features?.vanilla?.sensitivity]);
  useEffect(() => {
    setBugPredictionSensitivity(
      sensitivityOptions.some(opt => opt.value === config?.features?.bug_prediction?.sensitivity)
        ? config?.features?.bug_prediction?.sensitivity
        : DEFAULT_SENSITIVITY
    );
  }, [config?.features?.bug_prediction?.sensitivity]);

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
            </Flex>
            {isEnabledVanillaPrReview && (
              <Flex paddingLeft="xl">
                <Flex direction="column" borderLeft="muted">
                  <StyledFieldGroup
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
                      value={vanillaPrReviewSensitivity}
                      options={sensitivityOptions}
                      onChange={async value => {
                        setVanillaPrReviewSensitivity(value.value);
                        await enableFeature({
                          feature: 'vanilla',
                          enabled: isEnabledVanillaPrReview,
                          sensitivity: value.value,
                        });
                        refetchConfig();
                      }}
                      menuWidth={350}
                      maxMenuWidth={500}
                    />
                  </StyledFieldGroup>
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
            </Flex>
            {isEnabledBugPrediction && (
              <Flex padding="0 xl">
                <Flex direction="column" borderLeft="muted">
                  <StyledFieldGroup
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
                      value={bugPredictionSensitivity}
                      options={sensitivityOptions}
                      onChange={async value => {
                        setBugPredictionSensitivity(value.value);
                        await enableFeature({
                          feature: 'bug_prediction',
                          enabled: isEnabledBugPrediction,
                          sensitivity: value.value,
                          triggers: {
                            on_ready_for_review: isEnabledBugPredictionOnReadyForReview,
                            on_command_phrase: isEnabledBugPredictionOnCommandPhrase,
                          },
                        });
                        refetchConfig();
                      }}
                      menuWidth={350}
                      maxMenuWidth={500}
                    />
                  </StyledFieldGroup>
                  <StyledFieldGroup
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
                          sensitivity: bugPredictionSensitivity,
                        });
                        refetchConfig();
                      }}
                      aria-label="Auto Run on Opened Pull Requests"
                    />
                  </StyledFieldGroup>
                  <StyledFieldGroup
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
                          sensitivity: bugPredictionSensitivity,
                        });
                        refetchConfig();
                      }}
                      aria-label="Run When Mentioned"
                    />
                  </StyledFieldGroup>
                </Flex>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Flex>
    </SlideOverPanel>
  );
}

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;

  & ${FieldDescription} {
    width: inherit;
  }
`;

export default ManageReposPanel;
