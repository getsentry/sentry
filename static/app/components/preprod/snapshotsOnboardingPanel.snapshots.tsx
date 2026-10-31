import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {GlobalStyles} from 'sentry/styles/global';

import {SnapshotsOnboardingPanel} from './snapshotsOnboardingPanel';

const PanelContainer = styled('div')`
  width: 1200px;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.primary};
`;

// CodeBlock reads its colors from global prism variables.
function Panel() {
  const theme = useTheme();
  return (
    <PanelContainer>
      <GlobalStyles theme={theme} />
      <SnapshotsOnboardingPanel projectSlug="web-app" />
    </PanelContainer>
  );
}

describe('SnapshotsOnboardingPanel', () => {
  it.snapshot('default', () => <Panel />, {tags: {area: 'snapshots'}});
});
