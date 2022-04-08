import styled from '@emotion/styled';

const PageAlertBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.headerBackground};
  background-color: ${p => p.theme.bannerBackground};
  padding: 6px 30px;
  font-size: 14px;
`;

export default PageAlertBar;
