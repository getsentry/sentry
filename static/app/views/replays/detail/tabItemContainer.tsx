import styled from '@emotion/styled';

const TabItemContainer = styled('div')`
  position: relative;
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  display: grid;

  .beforeCurrentTime,
  .afterCurrentTime {
    border-top: 1px solid transparent;
    border-bottom: 1px solid transparent;
  }

  .beforeHoverTime + .afterHoverTime {
    border-top-color: ${p => p.theme.tokens.border.accent.moderate};
  }
  .beforeHoverTime:last-child {
    border-bottom-color: ${p => p.theme.tokens.border.accent.moderate};
  }

  .beforeCurrentTime + .afterCurrentTime {
    border-top-color: ${p => p.theme.tokens.border.accent.vibrant};
  }
  .beforeCurrentTime:last-child {
    border-bottom-color: ${p => p.theme.tokens.border.accent.vibrant};
  }
`;

export default TabItemContainer;
