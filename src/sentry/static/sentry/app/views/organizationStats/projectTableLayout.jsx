import styled from 'react-emotion';
import overflowEllipsis from '../../styles/overflowEllipsis';

export const ProjectTableLayout = styled('div')`
  display: grid;
  grid-template-columns: auto 110px 120px 100px 100px;
  width: 100%;
`;

export const ProjectTableDataElement = styled('div')`
  text-align: right;
  padding: 0 ${p => p.theme.scale(0.5)};
  ${overflowEllipsis};
`;
