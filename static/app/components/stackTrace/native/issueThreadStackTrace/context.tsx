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
import {isNativePlatform} from 'sentry/utils/platform';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {setActiveThreadId as setCopyIssueDetailsActiveThreadId} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

import {
  getActiveThreadStackTraceModel,
  type ActiveThreadStackTraceModel,
} from './activeThreadModel';

interface IssueThreadStackTraceContextValue {
  activeThread: Thread | undefined;
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

type ActiveThreadContextValue = Omit<
  ActiveThreadStackTraceModel,
  'defaultIsNewestFirst' | 'defaultView' | 'stacktraceMeta'
>;

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
const ActiveThreadContext = createContext<ActiveThreadContextValue | null>(null);

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

export function useActiveThreadContext() {
  const context = useContext(ActiveThreadContext);
  if (!context) {
    throw new Error('useActiveThreadContext must be used within ActiveThreadProviders');
  }
  return context;
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
  const [activeThreadId, setActiveThreadId] = useState(() => findBestThread(threads)?.id);
  const activeThread = useMemo(
    () => threads.find(thread => thread.id === activeThreadId) ?? findBestThread(threads),
    [activeThreadId, threads]
  );

  useEffect(() => {
    setActiveThreadId(currentId =>
      threads.some(thread => thread.id === currentId)
        ? currentId
        : findBestThread(threads)?.id
    );
  }, [threads]);

  const setActiveThread = useCallback((thread: Thread | undefined) => {
    setActiveThreadId(thread?.id);
  }, []);

  const changeThread = useCallback(
    (direction: 'previous' | 'next') => {
      setActiveThreadId(currentId => {
        if (!threads.length) {
          return;
        }

        const currentIndex = threads.findIndex(thread => thread.id === currentId);
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

  const contextValue = useMemo<IssueThreadStackTraceContextValue>(
    () => ({
      activeThread,
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
      <ActiveThreadProviders>{children}</ActiveThreadProviders>
    </IssueThreadStackTraceContext.Provider>
  );
}

function ActiveThreadProviders({children}: {children: ReactNode}) {
  const {activeThread, event, groupingCurrentLevel, hasScmSourceContext, storageKey} =
    useIssueThreadStackTraceContext();
  const [persistedOptions] = useNativeDisplayOptionsStorage(storageKey);
  const model = useMemo(
    () => getActiveThreadStackTraceModel({activeThread, event}),
    [event, activeThread]
  );
  const {defaultIsMinified, defaultView} = getNativeDisplayOptionDefaults({
    defaultView: model.defaultView,
    hasMinifiedStacktrace: model.hasMinifiedStacktrace,
    persistedOptions,
  });

  const contextValue = useMemo<ActiveThreadContextValue>(
    () => ({
      activeException: model.activeException,
      activeThread: model.activeThread,
      exception: model.exception,
      hasMinifiedStacktrace: model.hasMinifiedStacktrace,
      minifiedStacktrace: model.minifiedStacktrace,
      platform: model.platform,
      stacktrace: model.stacktrace,
    }),
    [model]
  );

  useEffect(() => {
    setCopyIssueDetailsActiveThreadId(model.activeThread?.id);
  }, [model.activeThread?.id]);

  return (
    <ActiveThreadContext.Provider value={contextValue}>
      <StackTraceViewStateProvider
        platform={model.platform}
        hasMinifiedStacktrace={model.hasMinifiedStacktrace}
        defaultView={defaultView}
        defaultIsMinified={defaultIsMinified}
        defaultIsNewestFirst={model.defaultIsNewestFirst}
      >
        {model.stacktrace && isNativePlatform(model.platform) ? (
          <NativeStackTraceProvider
            event={event}
            stacktrace={model.stacktrace}
            minifiedStacktrace={model.minifiedStacktrace}
            groupingCurrentLevel={groupingCurrentLevel}
            hasScmSourceContext={hasScmSourceContext}
            meta={model.stacktraceMeta}
            platform={model.platform}
            displayOptionsStorageKey={storageKey}
          >
            {children}
          </NativeStackTraceProvider>
        ) : (
          children
        )}
      </StackTraceViewStateProvider>
    </ActiveThreadContext.Provider>
  );
}
