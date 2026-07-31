import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

const CHEVRON_SLOT_SIZE = 24;

export function ChevronAction() {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frameContextId, isExpandable, isExpanded, toggleExpansion} =
    useStackTraceFrameContext();

  if (!hasAnyExpandableFrames) {
    return null;
  }

  return (
    <ChevronSlot data-test-id="core-stacktrace-chevron-slot">
      {isExpandable ? (
        <Button
          aria-controls={frameContextId}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded ? t('Collapse frame details') : t('Expand frame details')
          }
          icon={<IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />}
          size="zero"
          variant="transparent"
          onClick={event => {
            event.stopPropagation();
            toggleExpansion();
          }}
        />
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
