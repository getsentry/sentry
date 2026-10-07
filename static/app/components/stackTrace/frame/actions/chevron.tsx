import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

const CHEVRON_SLOT_SIZE = '24px';

export function ChevronAction() {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frameContextId, isExpandable, isExpanded, toggleExpansion} =
    useStackTraceFrameContext();

  if (!hasAnyExpandableFrames) {
    return null;
  }

  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      justify="center"
      width={CHEVRON_SLOT_SIZE}
      height={CHEVRON_SLOT_SIZE}
      minWidth={CHEVRON_SLOT_SIZE}
      minHeight={CHEVRON_SLOT_SIZE}
      flexShrink={0}
      data-test-id="core-stacktrace-chevron-slot"
    >
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
    </Flex>
  );
}
