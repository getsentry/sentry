import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {FieldGroupProps} from './types';

type FieldHelpProps = Pick<FieldGroupProps, 'inline' | 'stacked'>;

const FieldHelp = styled('div')<FieldHelpProps>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${p => (p.stacked && !p.inline ? 0 : space(0.5))};
  line-height: 1.4;
`;

export default FieldHelp;
