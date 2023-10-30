import styled from '@emotion/styled';

const TabItemContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: grid;

  .beforeHoverTime + .afterHoverTime {
    border-top-color: ${p => p.theme.purple200};
  }
  .beforeHoverTime:last-child {
    border-bottom-color: ${p => p.theme.purple200};
  }

  .beforeCurrentTime + .afterCurrentTime {
    border-top-color: ${p => p.theme.purple300};
  }
  .beforeCurrentTime:last-child {
    border-bottom-color: ${p => p.theme.purple300};
  }
`;

export default TabItemContainer;
