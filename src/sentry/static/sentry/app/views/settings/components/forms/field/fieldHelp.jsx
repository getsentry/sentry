import styled from 'react-emotion';

import space from 'app/styles/space';

const FieldHelp = styled('div')`
  color: ${p => p.theme.gray2};
  font-size: 14px;
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(1))};
  line-height: 1.4;
`;

export default FieldHelp;
