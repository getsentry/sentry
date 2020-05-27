import styled from '@emotion/styled';

import space from 'app/styles/space';

const Header = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
`;

const Wrapper = styled('div')`
  margin-bottom: ${space(3)};
`;

export {Header, Wrapper};
