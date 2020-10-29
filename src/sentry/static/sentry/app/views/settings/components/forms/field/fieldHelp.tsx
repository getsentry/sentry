import styled from '@emotion/styled';

import space from 'app/styles/space';

const FieldHelp = styled('div')<{stacked?: boolean; inline?: boolean}>`
  color: ${p => p.theme.gray500};
  font-size: 14px;
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(1))};
  line-height: 1.4;
`;

export default FieldHelp;
