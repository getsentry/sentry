import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const FieldHelp = styled('div')<{inline?: boolean; stacked?: boolean}>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(0.5))};
`;

export default FieldHelp;
