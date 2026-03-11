import styled from '@emotion/styled';

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
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  padding: ${p => (p.noPadding ? 0 : p.theme.space.xl)};
  ${p => p.center && 'align-items: center'};

  &:last-child {
    border: 0;
  }
`;

export default PanelItem;
