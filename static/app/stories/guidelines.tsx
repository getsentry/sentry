import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {space} from 'sentry/styles/space';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

export function GuidelineLabel(props: {variant: 'do' | 'dont'}) {
  return (
    <Label variant={props.variant}>
      {props.variant === 'do' ? <IconCheckmark /> : <IconClose color="red400" />}
      {props.variant === 'do' ? 'Do' : "Don't"}
    </Label>
  );
}

const Label = styled('div')<{variant: 'do' | 'dont'}>`
  color: ${p =>
    isChonkTheme(p.theme)
      ? p.variant === 'do'
        ? p.theme.tokens.content.success
        : p.theme.tokens.content.danger
      : p.variant === 'do'
        ? p.theme.green400
        : p.theme.red400};
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeightBold};
  gap: ${space(0.5)};
`;
