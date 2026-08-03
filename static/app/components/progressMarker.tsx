import type {HTMLAttributes} from 'react';
import styled from '@emotion/styled';

import {IconCircle} from 'sentry/icons/iconCircle';
import {IconCircleCheckmark} from 'sentry/icons/iconCircleCheckmark';
import {IconPieHalf} from 'sentry/icons/iconPieHalf';
import {IconPieQuarter} from 'sentry/icons/iconPieQuarter';
import {IconPieThreeQuarters} from 'sentry/icons/iconPieThreeQuarters';
import type {IconSize} from 'sentry/utils/theme/types';

export type ProgressMarkerStep =
  | 'complete'
  | 'empty'
  | 'half'
  | 'quarter'
  | 'three-quarters';

interface ProgressMarkerProps extends HTMLAttributes<HTMLSpanElement> {
  step: ProgressMarkerStep;
  size?: IconSize;
}

export function ProgressMarker({
  step,
  size = 'md',
  'aria-label': ariaLabel,
  ...props
}: ProgressMarkerProps) {
  return (
    <ProgressIconFrame
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      {...props}
    >
      {getProgressMarkerIcon(step, size)}
    </ProgressIconFrame>
  );
}

function getProgressMarkerIcon(step: ProgressMarkerStep, size: IconSize) {
  switch (step) {
    case 'quarter':
      return <IconPieQuarter size={size} variant="muted" />;
    case 'half':
      return <IconPieHalf size={size} variant="warning" />;
    case 'three-quarters':
      return <IconPieThreeQuarters size={size} variant="success" />;
    case 'complete':
      return <IconCircleCheckmark size={size} variant="success" />;
    case 'empty':
      return <IconCircle size={size} variant="muted" />;
    default:
      return null;
  }
}

const ProgressIconFrame = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;

  svg {
    display: block;
  }
`;
