import styled from 'react-emotion';

import PanelItem from './panelItem';

const PanelItemGroup = styled('div')`
  border-left: 4px solid ${p => p.theme.borderLight};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.offWhite};

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${PanelItem} {
    border-bottom-color: ${p => p.theme.borderLight};

    &:last-child {
      border-bottom: none;
    }
  }
`;

export default PanelItemGroup;
