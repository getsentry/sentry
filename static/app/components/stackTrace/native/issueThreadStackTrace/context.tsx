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
import {
  getNativeDisplayOptionDefaults,
  useNativeDisplayOptionsStorage,
} from 'sentry/components/stackTrace/native/nativeDisplayOptionsPersistence';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import type {Event, Thread} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {setActiveThreadId as setCopyIssueDetailsActiveThreadId} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

import {
  getActiveThreadStackTraceModel,
  type ActiveThreadStackTraceModel,
} from './activeThreadModel';

interface IssueThreadStackTraceContextValue {
  activeThread: Thread | undefined;
  activeThreadModel: ActiveThreadStackTraceModel;
  changeThread: (direction: 'previous' | 'next') => void;
  event: Event;
  group: Group | undefined;
  groupingCurrentLevel: Group['metadata']['current_level'];
  hasMoreThanOneThread: boolean;
  hasScmSourceContext: boolean;
  projectSlug: Project['slug'];
  setActiveThread: (thread: Thread | undefined) => void;
  storageKey: string;
  threads: Thread[];
}

interface IssueThreadStackTraceProvidersProps {
  children: ReactNode;
  event: Event;
  group: Group | undefined;
  groupingCurrentLevel: Group['metadata']['current_level'];
  hasMoreThanOneThread: boolean;
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
  return useIssueThreadStackTraceContext().activeThread;
}

export function IssueThreadStackTraceProviders({
  children,
  event,
  group,
  groupingCurrentLevel,
  hasMoreThanOneThread,
  projectSlug,
  threads,
}: IssueThreadStackTraceProvidersProps) {
  const organization = useOrganization();
  const storageKey = `issue-details-stracktrace-display-${organization.slug}-${projectSlug}`;
  const {data: detailedProject} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug},
    {enabled: defined(projectSlug)}
  );
  const hasScmSourceContext = !!detailedProject?.scmSourceContextEnabled;
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
  const [persistedOptions] = useNativeDisplayOptionsStorage(storageKey);
  const {defaultIsMinified, defaultView} = getNativeDisplayOptionDefaults({
    defaultView: activeThreadModel.defaultView,
    hasMinifiedStacktrace: activeThreadModel.hasMinifiedStacktrace,
    persistedOptions,
  });

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
    setCopyIssueDetailsActiveThreadId(activeThreadModel.activeThread?.id);
  }, [activeThreadModel.activeThread?.id]);

  const contextValue = useMemo<IssueThreadStackTraceContextValue>(
    () => ({
      activeThread,
      activeThreadModel,
      changeThread,
      event,
      group,
      groupingCurrentLevel,
      hasMoreThanOneThread,
      hasScmSourceContext,
      projectSlug,
      setActiveThread,
      storageKey,
      threads,
    }),
    [
      activeThread,
      activeThreadModel,
      changeThread,
      event,
      group,
      groupingCurrentLevel,
      hasMoreThanOneThread,
      hasScmSourceContext,
      projectSlug,
      setActiveThread,
      storageKey,
      threads,
    ]
  );

  return (
    <IssueThreadStackTraceContext.Provider value={contextValue}>
      <StackTraceViewStateProvider
        platform={activeThreadModel.platform}
        hasMinifiedStacktrace={activeThreadModel.hasMinifiedStacktrace}
        defaultView={defaultView}
        defaultIsMinified={defaultIsMinified}
        defaultIsNewestFirst={activeThreadModel.defaultIsNewestFirst}
      >
        {activeThreadModel.stacktrace ? (
          <NativeStackTraceProvider
            event={event}
            stacktrace={activeThreadModel.stacktrace}
            minifiedStacktrace={activeThreadModel.minifiedStacktrace}
            groupingCurrentLevel={groupingCurrentLevel}
            hasScmSourceContext={hasScmSourceContext}
            meta={activeThreadModel.stacktraceMeta}
            platform={activeThreadModel.platform}
            displayOptionsStorageKey={storageKey}
          >
            {children}
          </NativeStackTraceProvider>
        ) : (
          children
        )}
      </StackTraceViewStateProvider>
    </IssueThreadStackTraceContext.Provider>
  );
}
