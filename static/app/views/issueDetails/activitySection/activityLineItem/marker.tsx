import styled from '@emotion/styled';

import {IconCircle} from 'sentry/icons/iconCircle';
import {IconCircleCheckmark} from 'sentry/icons/iconCircleCheckmark';
import {IconPieHalf} from 'sentry/icons/iconPieHalf';
import {IconPieQuarter} from 'sentry/icons/iconPieQuarter';
import {IconPieThreeQuarters} from 'sentry/icons/iconPieThreeQuarters';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';

type MarkerVariant =
  | 'assigned'
  | 'diagnosed'
  | 'dot'
  | 'fix-applied'
  | 'fix-proposed'
  | 'identified';

function getProgressMarkerVariant(item: GroupActivity): MarkerVariant {
  switch (item.type) {
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
    case GroupActivityType.SEER_PR_CREATED:
      return 'fix-proposed';
    case GroupActivityType.SET_RESOLVED:
    case GroupActivityType.SET_RESOLVED_BY_AGE:
    case GroupActivityType.SET_RESOLVED_IN_RELEASE:
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
    case GroupActivityType.MARK_REVIEWED:
      return 'fix-applied';
    case GroupActivityType.SET_ESCALATING:
    case GroupActivityType.SEER_RCA_COMPLETED:
      return 'diagnosed';
    case GroupActivityType.SEER_RCA_STARTED:
    case GroupActivityType.SEER_SOLUTION_STARTED:
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
    case GroupActivityType.SEER_CODING_STARTED:
    case GroupActivityType.SEER_CODING_COMPLETED:
    case GroupActivityType.SEER_ITERATION_STARTED:
    case GroupActivityType.SEER_ITERATION_COMPLETED:
      return 'dot';
    case GroupActivityType.SET_REGRESSION:
      return 'identified';
    case GroupActivityType.SET_UNRESOLVED:
      return 'forecast' in item.data && item.data.forecast ? 'diagnosed' : 'identified';
    case GroupActivityType.NOTE:
      return 'dot';
    case GroupActivityType.ASSIGNED:
    case GroupActivityType.UNASSIGNED:
      return 'assigned';
    default:
      return 'identified';
  }
}

function ProgressMarker({item}: {item: GroupActivity}) {
  const variant = getProgressMarkerVariant(item);

  if (variant === 'dot') {
    return (
      <ProgressDotFrame>
        <ProgressDot />
      </ProgressDotFrame>
    );
  }

  let icon: React.ReactNode;
  switch (variant) {
    case 'assigned':
      icon = <IconPieQuarter size="md" variant="muted" />;
      break;
    case 'diagnosed':
      icon = <IconPieHalf size="md" variant="warning" />;
      break;
    case 'fix-applied':
      icon = <IconCircleCheckmark size="md" variant="success" />;
      break;
    case 'fix-proposed':
      icon = <IconPieThreeQuarters size="md" variant="success" />;
      break;
    case 'identified':
      icon = <IconCircle size="md" variant="muted" />;
      break;
    default:
      icon = null;
  }

  return <ProgressIconFrame>{icon}</ProgressIconFrame>;
}

export function ActivityLineMarker({item}: {item: GroupActivity}) {
  return (
    <MarkerCell>
      <ProgressMarker item={item} />
    </MarkerCell>
  );
}

const MarkerCell = styled('div')`
  grid-column: 1;
  grid-row: 1;
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
`;

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
  border: 3px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-radius: 100%;
  background: ${p => p.theme.tokens.background.overlay};
`;

const ProgressDot = styled('span')`
  width: 10px;
  height: 10px;
  border-radius: 100%;
  background: ${p => p.theme.colors.gray300};
`;
