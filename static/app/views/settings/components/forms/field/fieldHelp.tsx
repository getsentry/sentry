import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const FieldHelp = styled('div')<{inline?: boolean; stacked?: boolean}>`
  color: ${p => p.theme.gray300};
  font-size: 14px;
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(1))};
  line-height: 1.4;
`;

export default FieldHelp;
