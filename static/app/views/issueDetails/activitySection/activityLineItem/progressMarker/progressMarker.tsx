import styled from '@emotion/styled';

import {IconCircle} from 'sentry/icons/iconCircle';
import {IconCircleCheckmark} from 'sentry/icons/iconCircleCheckmark';
import {IconPieHalf} from 'sentry/icons/iconPieHalf';
import {IconPieQuarter} from 'sentry/icons/iconPieQuarter';
import {IconPieThreeQuarters} from 'sentry/icons/iconPieThreeQuarters';

import type {ProgressMarkerVariant} from './variant';

export function ProgressMarker({variant}: {variant: ProgressMarkerVariant}) {
  if (variant === 'dot') {
    return (
      <ProgressDotFrame>
        <ProgressDot />
      </ProgressDotFrame>
    );
  }

  return <ProgressIconFrame>{getProgressMarkerIcon(variant)}</ProgressIconFrame>;
}

function getProgressMarkerIcon(variant: ProgressMarkerVariant) {
  switch (variant) {
    case 'routed':
      return <IconPieQuarter size="md" variant="muted" />;
    case 'diagnosed':
      return <IconPieHalf size="md" variant="warning" />;
    case 'fix-applied':
      return <IconCircleCheckmark size="md" variant="success" />;
    case 'fix-proposed':
      return <IconPieThreeQuarters size="md" variant="success" />;
    case 'identified':
      return <IconCircle size="md" variant="muted" />;
    default:
      return null;
  }
}

const ProgressIconFrame = styled('span')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-radius: 100%;
  background: ${p => p.theme.tokens.background.primary};

  svg {
    display: block;
  }
`;

const ProgressDotFrame = styled('span')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
`;

const ProgressDot = styled('span')`
  width: 10px;
  height: 10px;
  border-radius: 100%;
  background: ${p => p.theme.tokens.graphics.neutral.moderate};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 4px ${p => p.theme.tokens.background.primary};
`;
