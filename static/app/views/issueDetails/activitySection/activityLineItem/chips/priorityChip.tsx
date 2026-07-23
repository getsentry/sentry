import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {t} from 'sentry/locale';
import {PriorityLevel} from 'sentry/types/group';

import {InlineChip} from './inlineChip';

function getPriorityBars(priority: PriorityLevel | string): 1 | 2 | 3 {
  switch (priority) {
    case PriorityLevel.HIGH:
      return 3;
    case PriorityLevel.MEDIUM:
      return 2;
    case PriorityLevel.LOW:
    default:
      return 1;
  }
}

function getPriorityLabel(priority: PriorityLevel | string) {
  switch (priority) {
    case PriorityLevel.HIGH:
      return t('High');
    case PriorityLevel.MEDIUM:
      return t('Med');
    case PriorityLevel.LOW:
      return t('Low');
    default:
      return priority;
  }
}

export function ActivityPriorityChip({priority}: {priority: PriorityLevel | string}) {
  return (
    <InlineChip variant="compactLeading">
      <IconCellSignal size="xs" bars={getPriorityBars(priority)} />
      {getPriorityLabel(priority)}
    </InlineChip>
  );
}
