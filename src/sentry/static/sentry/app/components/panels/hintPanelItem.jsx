import styled from 'react-emotion';

import space from 'app/styles/space';

const HintPanelItem = styled('div')`
  display: flex;
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.borderLighter};
  border-left: 1px solid ${p => p.theme.borderLighter};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.whiteDark};
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
