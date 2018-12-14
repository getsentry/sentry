import styled from 'react-emotion';

const PageHeader = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;

export default PageHeader;
