import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {Text} from 'sentry/components/core/text';
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
      <PanelWrapper>
        <PanelHeader>
          <PanelHeaderAllText>
            <PanelHeaderTitle>Prevent AI Settings</PanelHeaderTitle>
            <PanelHeaderDescription>
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
            </PanelHeaderDescription>
          </PanelHeaderAllText>
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
        </PanelHeader>
        {updateError && (
          <Alert type="error">{'Could not update settings. Please try again.'}</Alert>
        )}
        <PanelContent>
          {/* PR Review Feature */}
          <FeatureSectionContainer>
            <FeatureSectionTop>
              <FeatureSectionAllText>
                <FeatureSectionTitle>Enable PR Review</FeatureSectionTitle>
                <FeatureSectionDescription>
                  Run when @sentry review is commented on a PR.
                </FeatureSectionDescription>
              </FeatureSectionAllText>
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
          </FeatureSectionContainer>

          {/* Test Generation Feature */}
          <FeatureSectionContainer>
            <FeatureSectionTop>
              <FeatureSectionAllText>
                <FeatureSectionTitle>Enable Test Generation</FeatureSectionTitle>
                <FeatureSectionDescription>
                  Run when @sentry generate-test is commented on a PR.
                </FeatureSectionDescription>
              </FeatureSectionAllText>
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
          </FeatureSectionContainer>

          {/* Error Prediction Feature with SubItems */}
          <FeatureSectionContainer>
            <FeatureSectionTop>
              <FeatureSectionAllText>
                <FeatureSectionTitle>Enable Error Prediction</FeatureSectionTitle>
                <FeatureSectionDescription>
                  Allow organization members to review potential bugs.
                </FeatureSectionDescription>
              </FeatureSectionAllText>
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
                    <Text size="xs">
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
                    <Text size="xs">
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
          </FeatureSectionContainer>
        </PanelContent>
      </PanelWrapper>
    </SlideOverPanel>
  );
}

const PanelWrapper = styled(Flex)`
  flex-direction: column;
`;

const PanelHeader = styled(Flex)`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${p => `${p.theme.space.xl} ${p.theme.space['2xl']}`};
  justify-content: space-between;
  align-items: center;
`;

const PanelHeaderAllText = styled(Flex)`
  flex-direction: column;
`;

const PanelHeaderTitle = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  margin: 0 0 ${p => p.theme.space.xs} 0;
  color: ${p => p.theme.headingColor};
`;

const PanelHeaderDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const PanelContent = styled(Flex)`
  flex-direction: column;
  padding: ${p => p.theme.space['2xl']};
  gap: ${p => p.theme.space.xl};
`;

const FeatureSectionContainer = styled(Flex)`
  flex-direction: column;
`;

const FeatureSectionTop = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-radius: 6px;
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

const FeatureSectionAllText = styled(Flex)`
  flex-direction: column;
`;

const FeatureSectionTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
`;

const FeatureSectionDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-top: 2px;
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
