import {Fragment} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {IconCheckmark, IconWarning} from 'sentry/icons';
import {fadeOut, pulse} from 'sentry/styles/animations';

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

export const Spinner = styled('div')`
  animation: ${spin} 0.4s linear infinite;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  margin-left: 0;
`;

export const Checkmark = styled(IconCheckmark)`
  animation: ${fadeOut} 0.3s ease 2s 1 forwards;
`;

export const Warning = styled(IconWarning)`
  animation: ${() => pulse(1.15)} 1s ease infinite;
`;

const RequiredIndicatorBase = styled('div')`
  display: inline-block;
  background: ${p => p.theme.colors.red400};
  opacity: 0.6;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  text-indent: -9999em;
  vertical-align: super;
`;

export function RequiredIndicator() {
  return (
    <Fragment>
      <RequiredIndicatorBase aria-hidden />
      <VisuallyHidden>(required)</VisuallyHidden>
    </Fragment>
  );
}
