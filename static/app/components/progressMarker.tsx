import type {HTMLAttributes} from 'react';
import styled from '@emotion/styled';

import {IconCircle} from 'sentry/icons/iconCircle';
import {IconCircleCheckmark} from 'sentry/icons/iconCircleCheckmark';
import {IconPieHalf} from 'sentry/icons/iconPieHalf';
import {IconPieQuarter} from 'sentry/icons/iconPieQuarter';
import {IconPieThreeQuarters} from 'sentry/icons/iconPieThreeQuarters';

export type ProgressMarkerStep =
  | 'complete'
  | 'empty'
  | 'half'
  | 'quarter'
  | 'three-quarters';

interface ProgressMarkerProps extends HTMLAttributes<HTMLSpanElement> {
  step: ProgressMarkerStep;
}

export function ProgressMarker({
  step,
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
      {getProgressMarkerIcon(step)}
    </ProgressIconFrame>
  );
}

function getProgressMarkerIcon(step: ProgressMarkerStep) {
  switch (step) {
    case 'quarter':
      return <IconPieQuarter size="md" variant="muted" />;
    case 'half':
      return <IconPieHalf size="md" variant="warning" />;
    case 'three-quarters':
      return <IconPieThreeQuarters size="md" variant="success" />;
    case 'complete':
      return <IconCircleCheckmark size="md" variant="success" />;
    case 'empty':
      return <IconCircle size="md" variant="muted" />;
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
