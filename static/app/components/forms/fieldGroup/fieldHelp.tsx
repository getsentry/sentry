import styled from '@emotion/styled';

import type {FieldGroupProps} from './types';

interface FieldHelpProps extends Pick<FieldGroupProps, 'inline' | 'stacked'> {}

export const FieldHelp = styled('div')<FieldHelpProps>`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  margin-top: ${p => (p.stacked && !p.inline ? 0 : p.theme.space.xs)};
  line-height: 1.4;
`;
