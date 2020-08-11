import styled from '@emotion/styled';

import space from 'app/styles/space';

const FieldRequiredBadge = styled('div')`
  display: inline-block;
  background: ${p => p.theme.red400};
  opacity: 0.6;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  text-indent: -9999em;
  vertical-align: super;
  margin-left: ${space(0.5)};
`;

export default FieldRequiredBadge;
