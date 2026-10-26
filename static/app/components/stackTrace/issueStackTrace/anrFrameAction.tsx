import {Tag} from '@sentry/scraps/badge';

import {analyzeFrameForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import {SectionKey} from 'sentry/views/issueDetails/context';

export function AnrFrameAction() {
  const {thread, lockAddress} = useStackTraceContext();
  const {event, frame} = useStackTraceFrameContext();
  const mechanism = event.tags?.find(tag => tag.key === 'mechanism')?.value;
  if (mechanism !== 'ANR' && mechanism !== 'AppExitInfo') {
    return null;
  }
  if (!analyzeFrameForRootCause(frame, thread, lockAddress)) {
    return null;
  }
  return (
    <Tag
      variant="warning"
      onClick={clickEvent => {
        clickEvent.stopPropagation();
        document
          .getElementById(SectionKey.SUSPECT_ROOT_CAUSE)
          ?.scrollIntoView({block: 'start', behavior: 'smooth'});
      }}
    >
      {t('Suspect Frame')}
    </Tag>
  );
}
