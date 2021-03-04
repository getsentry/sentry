import styled from '@emotion/styled';

import space from 'app/styles/space';

const HintPanelItem = styled('div')`
  display: flex;
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  background: ${p => p.theme.backgroundSecondary};
  font-size: ${p => p.theme.fontSizeMedium};

  h2 {
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: 0;
  }

  &:last-child {
    border: 0;
  }
`;

export default HintPanelItem;
