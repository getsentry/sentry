import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  /**
   * Align items vertical center (assuming flex-direction isn't changed).
   */
  center?: boolean;
  /**
   * Disables the default padding
   */
  noPadding?: boolean;
};

const PanelItem = styled('div')<Props>`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  ${p => p.noPadding || `padding: ${space(2)}`};
  ${p => p.center && 'align-items: center'};

  &:last-child {
    border: 0;
  }
`;

export default PanelItem;
