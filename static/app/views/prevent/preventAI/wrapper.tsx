import {useState} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconSettings} from 'sentry/icons';
import useOrganization from 'sentry/utils/useOrganization';
import ManageReposPanel from 'sentry/views/prevent/preventAI/manageReposPanel';
import {PREVENT_AI_PAGE_TITLE} from 'sentry/views/prevent/settings';

export default function PreventAIPageWrapper() {
  const organization = useOrganization();

  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  const handleSettingsClick = () => {
    setIsSettingsPanelOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsPanelOpen(false);
  };

  return (
    <SentryDocumentTitle title={PREVENT_AI_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <HeaderContentBar>
            <Layout.Title>
              {PREVENT_AI_PAGE_TITLE}
              <FeatureBadge type="beta" />
            </Layout.Title>
            <Button
              borderless
              icon={<IconSettings size="md" />}
              aria-label="Settings"
              onClick={handleSettingsClick}
            />
          </HeaderContentBar>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <PreventQueryParamsProvider>
          <Layout.Main fullWidth>
            <Outlet />
          </Layout.Main>
          <ManageReposPanel
            collapsed={!isSettingsPanelOpen}
            onClose={handleCloseSettings}
            orgName={organization.name}
            repoName={'TODO'}
          />
        </PreventQueryParamsProvider>
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
