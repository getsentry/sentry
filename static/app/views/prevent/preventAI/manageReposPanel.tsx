import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Switch} from 'sentry/components/core/switch';
import {Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

import usePreventAIConfig from './hooks/usePreventAIConfig';
import useUpdatePreventAIFeature from './hooks/useUpdatePreventAIFeature';

interface RepoSettingsSidePanelProps {
  collapsed: boolean;
  onClose: () => void;
  repoName: string;
  orgName?: string;
  repoFullName?: string;
}

function getGithubUrl(repoFullName?: string) {
  if (!repoFullName) return undefined;
  // repoFullName is expected to be "org/repo"
  return `https://github.com/${repoFullName}`;
}

export default function ManageReposPanel({
  collapsed,
  onClose,
  repoName,
  orgName,
  repoFullName,
}: RepoSettingsSidePanelProps) {
  // Use the config hook to get current feature state
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

  // Refetch config when org or repo changes
  useEffect(() => {
    if (orgName && repoName) {
      refetchConfig();
    }
  }, [orgName, repoName, refetchConfig]);

  // Extract feature states from config, fallback to false if loading or missing
  const enableTestGeneration = config?.features?.test_generation?.enabled ?? false;
  const enablePRReview = config?.features?.vanilla_pr_review?.enabled ?? false;
  const bugPredictionConfig = config?.features?.bug_prediction;
  const enableErrorPrediction = bugPredictionConfig?.enabled ?? false;
  const triggers = bugPredictionConfig?.triggers ?? {
    on_command_phrase: false,
    on_ready_for_review: false,
    on_new_commit: false,
  };

  // For error prediction, determine sub-toggle states from triggers
  const errorPredAutoRun = triggers?.on_ready_for_review ?? false;
  const errorPredMentionOnly = triggers?.on_command_phrase ?? false;

  const repoUrl = useMemo(() => {
    return getGithubUrl(repoFullName);
  }, [repoFullName]);

  // Handle missing data gracefully
  if (!orgName || !repoName || !repoFullName) {
    return (
      <SlideOverPanel
        collapsed={collapsed}
        slidePosition="right"
        ariaLabel="Settings Panel"
      >
        <div>Loading...</div>
      </SlideOverPanel>
    );
  }

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
              These settings apply to the selected{' '}
              {repoUrl ? (
                <RepoNameLink href={repoUrl} target="_blank" rel="noopener noreferrer">
                  {repoName}
                </RepoNameLink>
              ) : (
                <RepoName>enigma</RepoName>
              )}{' '}
              repository. To switch, use the repository selector in the page header.
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

        <PanelContent>
          {updateError && (
            <div
              style={{
                color: 'red',
                marginBottom: '16px',
                padding: '8px',
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
              }}
            >
              Error: {updateError}
            </div>
          )}
          <Flex direction="column" gap="xl" width="100%">
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
                  checked={enablePRReview}
                  disabled={isLoading}
                  onChange={async () => {
                    const newValue = !enablePRReview;
                    await enableFeature({
                      feature: 'vanilla_pr_review',
                      enabled: newValue,
                      triggers: newValue
                        ? {on_command_phrase: true}
                        : {on_command_phrase: false},
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
                  checked={enableTestGeneration}
                  disabled={isLoading}
                  onChange={async () => {
                    const newValue = !enableTestGeneration;
                    await enableFeature({
                      feature: 'test_generation',
                      enabled: newValue,
                      triggers: newValue
                        ? {on_command_phrase: true}
                        : {on_command_phrase: false},
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
                  checked={enableErrorPrediction}
                  disabled={isLoading}
                  onChange={async () => {
                    const newValue = !enableErrorPrediction;
                    await enableFeature({
                      feature: 'bug_prediction',
                      enabled: newValue,
                      triggers: newValue
                        ? {
                            on_ready_for_review: true,
                            on_new_commit: true,
                            on_command_phrase: false,
                          }
                        : {
                            on_ready_for_review: false,
                            on_new_commit: false,
                            on_command_phrase: false,
                          },
                    });
                    refetchConfig();
                  }}
                  aria-label="Enable Error Prediction"
                />
              </FeatureSectionTop>
              {enableErrorPrediction && (
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
                      checked={errorPredAutoRun}
                      disabled={isLoading}
                      onChange={async () => {
                        const newValue = !errorPredAutoRun;
                        const newTriggers = {
                          on_ready_for_review: newValue,
                          on_command_phrase: errorPredMentionOnly,
                          on_new_commit: enableErrorPrediction,
                        };
                        await enableFeature({
                          feature: 'bug_prediction',
                          enabled:
                            enableErrorPrediction || newValue || errorPredMentionOnly,
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
                      checked={errorPredMentionOnly}
                      disabled={isLoading}
                      onChange={async () => {
                        const newValue = !errorPredMentionOnly;
                        const newTriggers = {
                          on_ready_for_review: errorPredAutoRun,
                          on_command_phrase: newValue,
                          on_new_commit: enableErrorPrediction,
                        };
                        await enableFeature({
                          feature: 'bug_prediction',
                          enabled: enableErrorPrediction || errorPredAutoRun || newValue,
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
          </Flex>
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

const FeatureSectionSubItemContainer = styled(Flex)`
  flex-direction: column;
  margin-left: ${p => p.theme.space.xl};
  border-left: 2px solid ${p => p.theme.border};
  padding-left: ${p => p.theme.space.md};
  gap: ${p => p.theme.space.md};
`;

/// fix these

const RepoName = styled('span')`
  color: #6559c5;
  font-weight: bold;
  display: inline;
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.4;
`;

const RepoNameLink = styled('a')`
  color: #6559c5;
  font-weight: bold;
  display: inline;
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.4;
  text-decoration: underline;
  &:hover {
    color: #4836a8;
  }
`;
