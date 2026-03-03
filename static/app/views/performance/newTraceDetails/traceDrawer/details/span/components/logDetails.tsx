import {t} from 'sentry/locale';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

export function LogDetails() {
  const logsQueryResult = useLogsPageDataQueryResult();

  if (!logsQueryResult?.data?.length) {
    return null;
  }
  return (
    <FoldSection
      sectionKey={SectionKey.LOGS}
      title={t('Logs')}
      disableCollapsePersistence
    >
      <LogsInfiniteTable embedded />
    </FoldSection>
  );
}
