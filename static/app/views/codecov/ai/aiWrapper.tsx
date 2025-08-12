import {useState} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {Switch} from 'sentry/components/core/switch';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose, IconSettings} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {AI_PAGE_TITLE} from 'sentry/views/codecov/settings';

export default function AIPageWrapper() {
  const organization = useOrganization();
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  // Settings state
  const [enableTestGeneration, setEnableTestGeneration] = useState(true);
  const [enablePRReview, setEnablePRReview] = useState(true);
  const [enableErrorPrediction, setEnableErrorPrediction] = useState(true);

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
        </CodecovQueryParamsProvider>
      </Layout.Body>
      <SlideOverPanel
        collapsed={!isSettingsPanelOpen}
        slidePosition="right"
        ariaLabel="Settings Panel"
      >
        <SettingsHeader>
          <SettingsTitle>Prevent AI Settings</SettingsTitle>
          <Button
            priority="transparent"
            size="xs"
            aria-label="Close Settings"
            icon={<IconClose />}
            onClick={handleCloseSettings}
          >
            Close
          </Button>
        </SettingsHeader>
        <SettingsContent>
          <FieldGroup
            label="Enable PR Review"
            help="Allow organization members to use AI reviews prs."
            inline
            flexibleControlStateSize
          >
            <Switch
              size="lg"
              checked={enablePRReview}
              onChange={() => setEnablePRReview(!enablePRReview)}
              aria-label="Enable PR Review"
            />
          </FieldGroup>
          <FieldGroup
            label="Enable Test Generation"
            help="Allow organization members to use AI generates tests."
            inline
            flexibleControlStateSize
          >
            <Switch
              size="lg"
              checked={enableTestGeneration}
              onChange={() => setEnableTestGeneration(!enableTestGeneration)}
              aria-label="Enable Test Generation"
            />
          </FieldGroup>
          <FieldGroup
            label="Enable Error Prediction"
            help="Allow organization members to review potential bugs."
            inline
            flexibleControlStateSize
          >
            <Switch
              size="lg"
              checked={enableErrorPrediction}
              onChange={() => setEnableErrorPrediction(!enableErrorPrediction)}
              aria-label="Enable Error Prediction"
            />
          </FieldGroup>
        </SettingsContent>
      </SlideOverPanel>
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
  padding: ${space(2)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

const SettingsTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SettingsContent = styled('div')`
  padding: ${space(3)};

  /* Override FieldDescription width for this layout */
  & label {
    width: 60% !important;
  }
`;
