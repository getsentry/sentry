import {useRef} from 'react';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

export function LogDetails() {
  const logsQueryResult = useLogsPageDataQueryResult();
  const hasInfiniteFeature = useOrganization().features.includes(
    'ourlogs-infinite-scroll'
  );
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
      {hasInfiniteFeature ? (
        <LogsInfiniteTable embedded scrollContainer={scrollContainer} />
      ) : (
        <LogsTable embedded />
      )}
    </FoldSection>
  );
}
