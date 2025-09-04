import {useState} from 'react';
import styled from '@emotion/styled';

import {FeatureOverview} from './onboarding';
import RepoSettingsSidePanel from './repoSettingsSidePanel';
import {PreventAIToolbar} from './toolbar';

function PreventAIMainPanel() {
  return (
    <div>
      <div>Manage Repositories</div>
      <div>
        To install more repositories or uninstall the app, go to your Seer by Sentry app
      </div>
      <FeatureOverview />
    </div>
  );
}

export default function PreventAIConfig() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <Container>
      <Header>
        <div>Prevent AI</div>
        <OpenPanelButton onClick={() => setIsPanelOpen(true)}>
          Open Side Panel
        </OpenPanelButton>
      </Header>
      <PreventAIToolbar />
      <PreventAIMainPanel />
      <RepoSettingsSidePanel
        collapsed={!isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const OpenPanelButton = styled('button')`
  margin-left: auto;
  padding: 8px 16px;
  background: #6c5fc7;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;
