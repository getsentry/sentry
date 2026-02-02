import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

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
  width: 18px;
  height: 18px;
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
