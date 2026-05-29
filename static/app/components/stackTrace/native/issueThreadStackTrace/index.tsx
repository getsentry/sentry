import {useEffect, useMemo, useRef} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {t, tn} from 'sentry/locale';
import type {EntryThreads, Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {IssueThreadStackTraceActions} from './actions';
import {
  ActiveThreadStackTrace,
  IssueThreadStackTraceSuspectCommits,
} from './activeThreadStackTrace';
import {
  IssueThreadStackTraceProviders,
  IssueThreadStackTraceStoreProvider,
} from './context';
import {
  createIssueThreadStackTraceStore,
  type IssueThreadStackTraceStore,
} from './threadStore';
import {ThreadSummary} from './threadSummary';

type Props = {
  data: EntryThreads['data'];
  event: Event;
  group: Group | undefined;
  groupingCurrentLevel: Group['metadata']['current_level'];
  projectSlug: Project['slug'];
};

export function IssueThreadStackTrace({
  data,
  event,
  projectSlug,
  groupingCurrentLevel,
  group,
}: Props) {
  const threads = useMemo(
    () => (data.values ?? []).toSorted((a, b) => Number(b.crashed) - Number(a.crashed)),
    [data.values]
  );
  const storeRef = useRef<{
    eventId: Event['id'];
    store: IssueThreadStackTraceStore;
  }>(null);
  if (storeRef.current?.eventId !== event.id) {
    storeRef.current = {
      eventId: event.id,
      store: createIssueThreadStackTraceStore(event, threads),
    };
  }
  const store = storeRef.current.store;

  useEffect(() => {
    store.sync(event, threads);
  }, [event, store, threads]);

  const hasMoreThanOneThread = threads.length > 1;

  return (
    <IssueThreadStackTraceStoreProvider store={store}>
      <IssueThreadStackTraceProviders
        event={event}
        group={group}
        groupingCurrentLevel={groupingCurrentLevel}
        hasMoreThanOneThread={hasMoreThanOneThread}
        projectSlug={projectSlug}
        threads={threads}
      >
        <FoldSection
          sectionKey={hasMoreThanOneThread ? SectionKey.THREADS : SectionKey.STACKTRACE}
          title={
            hasMoreThanOneThread
              ? tn('Stack Trace', 'Stack Traces', threads.length)
              : t('Stack Trace')
          }
          actions={<IssueThreadStackTraceActions />}
          disableCollapsePersistence={hasMoreThanOneThread}
        >
          <Flex direction="column" gap="lg">
            <ThreadSummary />
            <ActiveThreadStackTrace />
            <IssueThreadStackTraceSuspectCommits />
          </Flex>
        </FoldSection>
      </IssueThreadStackTraceProviders>
    </IssueThreadStackTraceStoreProvider>
  );
}
