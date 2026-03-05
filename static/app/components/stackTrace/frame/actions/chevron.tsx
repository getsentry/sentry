import styled from '@emotion/styled';

import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

export function ChevronAction() {
  const {isExpandable, isExpanded, frameContextId, toggleExpansion} =
    useStackTraceFrameContext();

  if (!isExpandable) {
    return null;
  }

  return (
    <ChevronToggle
      type="button"
      aria-label={isExpanded ? t('Collapse frame') : t('Expand frame')}
      aria-controls={frameContextId}
      aria-expanded={isExpanded}
      data-test-id="core-stacktrace-chevron-toggle"
      onKeyDown={keyboardEvent => {
        if (keyboardEvent.key === ' ' || keyboardEvent.key === 'Spacebar') {
          keyboardEvent.preventDefault();
        }
      }}
      onKeyUp={keyboardEvent => {
        if (keyboardEvent.key === ' ' || keyboardEvent.key === 'Spacebar') {
          keyboardEvent.preventDefault();
          toggleExpansion();
        }
      }}
      onClick={e => {
        e.stopPropagation();
        toggleExpansion();
      }}
    >
      <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
    </ChevronToggle>
  );
}

const ChevronToggle = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  border: 0;
  border-radius: ${p => p.theme.radius.md};
  background: transparent;
  color: inherit;
  padding: 0;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  pointer-events: auto;

  svg {
    pointer-events: none;
  }
`;
