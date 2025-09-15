import {useRef} from 'react';

import {t} from 'sentry/locale';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

export function LogDetails() {
  const logsQueryResult = useLogsPageDataQueryResult();

  const scrollContainer = useRef<HTMLDivElement>(null);
  if (!logsQueryResult?.data?.length) {
    return null;
  }
  return (
    <FoldSection
      ref={scrollContainer}
      sectionKey={SectionKey.LOGS}
      title={t('Logs')}
      disableCollapsePersistence
    >
      <LogsInfiniteTable embedded scrollContainer={scrollContainer} />
    </FoldSection>
  );
}
