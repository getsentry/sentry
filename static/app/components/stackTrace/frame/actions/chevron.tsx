import styled from '@emotion/styled';

import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconChevron} from 'sentry/icons';

const CHEVRON_SLOT_SIZE = 24;

export function ChevronAction() {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {isExpandable, isExpanded} = useStackTraceFrameContext();

  if (!hasAnyExpandableFrames) {
    return null;
  }

  return (
    <ChevronSlot data-test-id="core-stacktrace-chevron-slot" aria-hidden>
      {isExpandable ? (
        <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
      ) : null}
    </ChevronSlot>
  );
}

const ChevronSlot = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${CHEVRON_SLOT_SIZE}px;
  height: ${CHEVRON_SLOT_SIZE}px;
  min-width: ${CHEVRON_SLOT_SIZE}px;
  min-height: ${CHEVRON_SLOT_SIZE}px;
  color: inherit;
  flex-shrink: 0;
`;
