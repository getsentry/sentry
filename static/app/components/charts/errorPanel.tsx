import styled from '@emotion/styled';

const ErrorPanel = styled('div')<{height?: string}>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: ${p => p.height || '200px'};
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

export default ErrorPanel;
