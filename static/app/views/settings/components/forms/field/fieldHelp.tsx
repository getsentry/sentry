import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const FieldHelp = styled('div')<{stacked?: boolean; inline?: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(0.5))};
  line-height: 1.2;

  p {
    line-height: 1.2;
  }
`;

export default FieldHelp;
