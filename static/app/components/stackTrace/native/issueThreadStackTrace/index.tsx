import {useMemo} from 'react';

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
import {IssueThreadStackTraceProviders} from './context';
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
  const hasMoreThanOneThread = threads.length > 1;

  return (
    <IssueThreadStackTraceProviders
      key={event.id}
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
  );
}
