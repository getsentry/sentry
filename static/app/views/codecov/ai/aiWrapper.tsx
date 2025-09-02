import React, {useState} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {Switch} from 'sentry/components/core/switch';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {FieldDescription} from 'sentry/components/forms/fieldGroup/fieldDescription';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose, IconSettings} from 'sentry/icons';
import useOrganization from 'sentry/utils/useOrganization';
import {AI_PAGE_TITLE} from 'sentry/views/codecov/settings';

function SettingsPanel({isOpen, onClose}: {isOpen: boolean; onClose: () => void}) {
  const {repository} = useCodecovContext();

  // Settings state
  const [enableTestGeneration, setEnableTestGeneration] = useState(true);
  const [enablePRReview, setEnablePRReview] = useState(true);
  const [enableErrorPrediction, setEnableErrorPrediction] = useState(true);

  // PR Review sub-settings
  const [_prReviewAutoRun, _setPrReviewAutoRun] = useState(true);
  const [_prReviewMentionOnly, _setPrReviewMentionOnly] = useState(false);

  // Test Generation sub-settings
  const [_testGenAutoRun, _setTestGenAutoRun] = useState(true);
  const [_testGenMentionOnly, _setTestGenMentionOnly] = useState(false);

  // Error Prediction sub-settings
  const [errorPredAutoRun, setErrorPredAutoRun] = useState(true);
  const [errorPredMentionOnly, setErrorPredMentionOnly] = useState(false);

  return (
    <SlideOverPanel collapsed={!isOpen} slidePosition="right" ariaLabel="Settings Panel">
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
            onChange={() => setEnablePRReview(!enablePRReview)}
            aria-label="Enable PR Review"
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
            onChange={() => setEnableTestGeneration(!enableTestGeneration)}
            aria-label="Enable Test Generation"
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
            onChange={() => setEnableErrorPrediction(!enableErrorPrediction)}
            aria-label="Enable Error Prediction"
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
                onChange={() => setErrorPredAutoRun(!errorPredAutoRun)}
                aria-label="Auto Run on Opened Pull Requests"
              />
            </FieldGroup>
            <FieldGroup
              label="Only Run When Mentioned"
              help="Only run when @sentry review is commented on a PR"
              inline
              flexibleControlStateSize
            >
              <Switch
                size="lg"
                checked={errorPredMentionOnly}
                onChange={() => setErrorPredMentionOnly(!errorPredMentionOnly)}
                aria-label="Only Run When Mentioned"
              />
            </FieldGroup>
          </NestedFieldGroup>
        )}
      </SettingsContent>
    </SlideOverPanel>
  );
}

export default function AIPageWrapper() {
  const organization = useOrganization();
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  const handleSettingsClick = () => {
    setIsSettingsPanelOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsPanelOpen(false);
  };

  return (
    <SentryDocumentTitle title={AI_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <HeaderContentBar>
            <Layout.Title>
              {AI_PAGE_TITLE}
              <FeatureBadge type="new" />
            </Layout.Title>
            <Button
              size="zero"
              priority="link"
              borderless
              icon={<IconSettings color="gray500" />}
              aria-label="Settings"
              onClick={handleSettingsClick}
            />
          </HeaderContentBar>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <CodecovQueryParamsProvider>
          <Layout.Main fullWidth>
            <Outlet />
          </Layout.Main>
          <SettingsPanel isOpen={isSettingsPanelOpen} onClose={handleCloseSettings} />
        </CodecovQueryParamsProvider>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}

const HeaderContentBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

const SettingsHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const SettingsTitle = styled('h3')`
  margin: 0 0 ${p => p.theme.space.xs} 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.primary};
`;

const SettingsDescription = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.muted};
  line-height: 1.4;
`;

const RepoName = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.primary};
`;

const SettingsContent = styled('div')`
  padding: ${p => p.theme.space['2xl']};

  /* Override FieldDescription width for this layout */
  & label {
    width: 60% !important;
  }
`;

const FeatureSection = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.tokens.background.secondary};

  & > div:first-child {
    flex: 1;
    padding-right: ${p => p.theme.space.xl};
  }
`;

const FeatureSectionTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.primary};
`;

const FeatureSectionDescription = styled('p')`
  margin: ${p => p.theme.space.xs} 0 0 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.muted};
`;

const NestedFieldGroup = styled('div')`
  margin-left: ${p => p.theme.space.lg};
  margin-top: -${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
  padding-left: ${p => p.theme.space.lg};
  border-left: 2px solid ${p => p.theme.tokens.border.muted};

  & > div {
    margin-bottom: 0;
  }

  & > div:last-child {
    margin-bottom: 0;
  }

  /* Override FieldDescription width for nested field groups */
  & ${FieldDescription} {
    width: 80% !important;
  }
`;
