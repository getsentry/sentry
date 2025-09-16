import React, {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Switch} from 'sentry/components/core/switch';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';

import usePreventAIConfig from './hooks/usePreventAIConfig';
import useUpdatePreventAIFeature from './hooks/useUpdatePreventAIFeature';

interface RepoSettingsSidePanelProps {
  collapsed: boolean;
  onClose: () => void;
}

export default function ManageReposPanel({
  collapsed,
  onClose,
}: RepoSettingsSidePanelProps) {
  // TODO: Replace with actual repository name from context if available
  const repository = undefined;

  // Use the config hook to get current feature state
  const {data: config, isLoading} = usePreventAIConfig();
  const {enableFeature} = useUpdatePreventAIFeature();

  // Extract feature states from config, fallback to false if loading or missing
  const enableTestGeneration = config?.features?.test_generation?.enabled ?? false;
  const enablePRReview = config?.features?.vanilla_pr_review?.enabled ?? false;
  const bugPredictionConfig = config?.features?.bug_prediction;
  const enableErrorPrediction = bugPredictionConfig?.enabled ?? false;
  const triggers = bugPredictionConfig?.triggers ?? [];

  // For error prediction, determine sub-toggle states from triggers
  const errorPredAutoRun = triggers.includes('on_ready_for_review');
  const errorPredMentionOnly = triggers.includes('on_command_phrase');

  // Handlers for toggles
  const handleToggleTestGeneration = useCallback(async () => {
    const newValue = !enableTestGeneration;
    await enableFeature({
      feature: 'test_generation',
      enabled: newValue,
      triggers: newValue ? ['on_command_phrase'] : [],
    });
  }, [enableTestGeneration, enableFeature]);

  const handleTogglePRReview = useCallback(async () => {
    const newValue = !enablePRReview;
    await enableFeature({
      feature: 'vanilla_pr_review',
      enabled: newValue,
      triggers: newValue ? ['on_command_phrase'] : [],
    });
  }, [enablePRReview, enableFeature]);

  const handleToggleErrorPrediction = useCallback(async () => {
    const newValue = !enableErrorPrediction;
    await enableFeature({
      feature: 'bug_prediction',
      enabled: newValue,
      triggers: newValue ? ['on_ready_for_review', 'on_new_commit'] : [],
    });
    // No need to set sub-toggles, as they are derived from config
  }, [enableErrorPrediction, enableFeature]);

  const handleToggleErrorPredAutoRun = useCallback(async () => {
    const newValue = !errorPredAutoRun;
    // Compose triggers based on both sub-toggles
    const newTriggers = [
      ...(newValue ? ['on_ready_for_review'] : []),
      ...(errorPredMentionOnly ? ['on_command_phrase'] : []),
      ...(enableErrorPrediction ? ['on_new_commit'] : []),
    ];
    await enableFeature({
      feature: 'bug_prediction',
      enabled: enableErrorPrediction || newValue || errorPredMentionOnly,
      triggers: newTriggers,
    });
  }, [errorPredAutoRun, errorPredMentionOnly, enableErrorPrediction, enableFeature]);

  const handleToggleErrorPredMentionOnly = useCallback(async () => {
    const newValue = !errorPredMentionOnly;
    // Compose triggers based on both sub-toggles
    const newTriggers = [
      ...(errorPredAutoRun ? ['on_ready_for_review'] : []),
      ...(newValue ? ['on_command_phrase'] : []),
      ...(enableErrorPrediction ? ['on_new_commit'] : []),
    ];
    await enableFeature({
      feature: 'bug_prediction',
      enabled: enableErrorPrediction || errorPredAutoRun || newValue,
      triggers: newTriggers,
    });
  }, [errorPredAutoRun, errorPredMentionOnly, enableErrorPrediction, enableFeature]);

  return (
    <SlideOverPanel
      collapsed={collapsed}
      slidePosition="right"
      ariaLabel="Settings Panel"
    >
      <SettingsHeader>
        <div>
          <SettingsTitle>Prevent AI Settings</SettingsTitle>
          <SettingsDescription>
            These settings apply to the selected <b style={{color: '#6559C5'}}>enigma</b>{' '}
            repository. To switch, use the repository selector in the page header.
            {repository && (
              <React.Fragment>
                {' '}
                Currently configuring settings for: <RepoName>{repository}</RepoName>
              </React.Fragment>
            )}
          </SettingsDescription>
        </div>
        <Button
          priority="transparent"
          size="xs"
          aria-label="Close Settings"
          icon={<IconClose />}
          onClick={onClose}
        >
          Close
        </Button>
      </SettingsHeader>
      <SettingsContent>
        <FeatureSection>
          <div>
            <FeatureSectionTitle>Enable PR Review</FeatureSectionTitle>
            <FeatureSectionDescription>
              Run when @sentry review is commented on a PR.
            </FeatureSectionDescription>
          </div>
          <Switch
            size="lg"
            checked={enablePRReview}
            onChange={handleTogglePRReview}
            aria-label="Enable PR Review"
            disabled={isLoading}
          />
        </FeatureSection>

        <FeatureSection>
          <div>
            <FeatureSectionTitle>Enable Test Generation</FeatureSectionTitle>
            <FeatureSectionDescription>
              Run when @sentry generate-test is commented on a PR.
            </FeatureSectionDescription>
          </div>
          <Switch
            size="lg"
            checked={enableTestGeneration}
            onChange={handleToggleTestGeneration}
            aria-label="Enable Test Generation"
            disabled={isLoading}
          />
        </FeatureSection>

        <FeatureSection>
          <div>
            <FeatureSectionTitle>Enable Error Prediction</FeatureSectionTitle>
            <FeatureSectionDescription>
              Allow organization members to review potential bugs.
            </FeatureSectionDescription>
          </div>
          <Switch
            size="lg"
            checked={enableErrorPrediction}
            onChange={handleToggleErrorPrediction}
            aria-label="Enable Error Prediction"
            disabled={isLoading}
          />
        </FeatureSection>

        {enableErrorPrediction && (
          <NestedFieldGroup>
            <FieldGroup
              label="Auto Run on Opened Pull Requests"
              help="Run when a PR is published, ignoring new pushes."
              inline
              flexibleControlStateSize
            >
              <Switch
                size="lg"
                checked={errorPredAutoRun}
                onChange={handleToggleErrorPredAutoRun}
                aria-label="Auto Run on Opened Pull Requests"
                disabled={isLoading}
              />
            </FieldGroup>
            <FieldGroup
              label="Run When Mentioned"
              help="Run when @sentry review is commented on a PR"
              inline
              flexibleControlStateSize
            >
              <Switch
                size="lg"
                checked={errorPredMentionOnly}
                onChange={handleToggleErrorPredMentionOnly}
                aria-label="Run When Mentioned"
                disabled={isLoading}
              />
            </FieldGroup>
          </NestedFieldGroup>
        )}
      </SettingsContent>
    </SlideOverPanel>
  );
}

const SettingsHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
`;

const SettingsTitle = styled('h3')`
  margin: 0 0 4px 0;
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.headingColor};
`;

const SettingsDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;

const RepoName = styled('span')`
  color: #6559c5;
  font-weight: bold;
`;

const SettingsContent = styled('div')`
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const FeatureSection = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 8px;
  padding: 16px 20px;
  border: 1px solid ${p => p.theme.border};
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

const NestedFieldGroup = styled('div')`
  margin-left: 32px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
