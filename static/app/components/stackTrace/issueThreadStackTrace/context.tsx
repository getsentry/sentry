import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {ReactNode} from 'react';

import {findBestThread} from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import {NativeStackTraceViewStateProvider} from 'sentry/components/stackTrace/native/nativeDisplayOptionsContext';
import type {Event, Thread} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {setActiveThreadId as setCopyIssueDetailsActiveThreadId} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

import {
  getActiveThreadStackTraceModel,
  type ActiveThreadStackTraceModel,
} from './activeThreadModel';

interface IssueThreadStackTraceContextValue {
  activeThreadModel: ActiveThreadStackTraceModel;
  changeThread: (direction: 'previous' | 'next') => void;
  event: Event;
  group: Group | undefined;
  groupingCurrentLevel: Group['metadata']['current_level'];
  hasScmSourceContext: boolean;
  isShared: boolean;
  projectSlug: Project['slug'];
  setActiveThread: (thread: Thread | undefined) => void;
  threads: Thread[];
}

interface IssueThreadStackTraceProvidersProps {
  children: ReactNode;
  event: Event;
  group: Group | undefined;
  groupingCurrentLevel: Group['metadata']['current_level'];
  isShared: boolean;
  projectSlug: Project['slug'];
  threads: Thread[];
}

const IssueThreadStackTraceContext =
  createContext<IssueThreadStackTraceContextValue | null>(null);

export function useIssueThreadStackTraceContext() {
  const context = useContext(IssueThreadStackTraceContext);
  if (!context) {
    throw new Error(
      'useIssueThreadStackTraceContext must be used within IssueThreadStackTrace'
    );
  }
  return context;
}

export function useActiveThread() {
  return useIssueThreadStackTraceContext().activeThreadModel.activeThread;
}

export function IssueThreadStackTraceProviders({
  children,
  isShared,
  event,
  group,
  groupingCurrentLevel,
  projectSlug,
  threads,
}: IssueThreadStackTraceProvidersProps) {
  const organization = useOrganization();
  const storageKey = `issue-details-stracktrace-display-${organization.slug}-${projectSlug}`;
  const {data: detailedProject} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug},
    {enabled: !isShared && defined(projectSlug)}
  );
  const hasScmSourceContext = !isShared && !!detailedProject?.scmSourceContextEnabled;
  const [selectedThreadId, setSelectedThreadId] = useState(
    () => findBestThread(threads)?.id
  );
  const activeThread = useMemo(
    () =>
      threads.find(thread => thread.id === selectedThreadId) ?? findBestThread(threads),
    [selectedThreadId, threads]
  );
  const activeThreadModel = useMemo(
    () => getActiveThreadStackTraceModel({activeThread, event}),
    [activeThread, event]
  );
  const setActiveThread = useCallback((thread: Thread | undefined) => {
    setSelectedThreadId(thread?.id);
  }, []);

  const changeThread = useCallback(
    (direction: 'previous' | 'next') => {
      setSelectedThreadId(currentId => {
        if (!threads.length) {
          return;
        }

        const selectedThread =
          threads.find(thread => thread.id === currentId) ?? findBestThread(threads);
        const currentIndex = threads.findIndex(
          thread => thread.id === selectedThread?.id
        );
        let nextIndex =
          direction === 'previous'
            ? (currentIndex === -1 ? 0 : currentIndex) - 1
            : (currentIndex === -1 ? 0 : currentIndex) + 1;
        if (nextIndex < 0) {
          nextIndex = threads.length - 1;
        } else if (nextIndex >= threads.length) {
          nextIndex = 0;
        }

        return threads[nextIndex]?.id;
      });
    },
    [threads]
  );

  useEffect(() => {
    if (!isShared) {
      setCopyIssueDetailsActiveThreadId(activeThreadModel.activeThread?.id);
    }
  }, [activeThreadModel.activeThread?.id, isShared]);

  const contextValue = useMemo<IssueThreadStackTraceContextValue>(
    () => ({
      activeThreadModel,
      isShared,
      changeThread,
      event,
      group,
      groupingCurrentLevel,
      hasScmSourceContext,
      projectSlug,
      setActiveThread,
      threads,
    }),
    [
      activeThreadModel,
      isShared,
      changeThread,
      event,
      group,
      groupingCurrentLevel,
      hasScmSourceContext,
      projectSlug,
      setActiveThread,
      threads,
    ]
  );

  return (
    <IssueThreadStackTraceContext value={contextValue}>
      <NativeStackTraceViewStateProvider
        platform={activeThreadModel.platform}
        hasMinifiedStacktrace={activeThreadModel.hasMinifiedStacktrace}
        defaultView={activeThreadModel.defaultView}
        defaultIsNewestFirst={activeThreadModel.defaultIsNewestFirst}
        storageKey={isShared ? undefined : storageKey}
      >
        {children}
      </NativeStackTraceViewStateProvider>
    </IssueThreadStackTraceContext>
  );
}
