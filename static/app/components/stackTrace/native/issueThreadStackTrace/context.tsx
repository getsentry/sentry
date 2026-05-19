import {createContext, useContext, useEffect, useMemo, useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';

import {getThreadException} from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import {
  inferPlatform,
  isStacktraceNewestFirst,
} from 'sentry/components/events/interfaces/utils';
import {
  getNativeDisplayOptionDefaults,
  useNativeDisplayOptionsStorage,
} from 'sentry/components/stackTrace/native/nativeDisplayOptionsPersistence';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import type {StackTraceView} from 'sentry/components/stackTrace/types';
import type {Event, ExceptionValue, Thread} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {isNativePlatform} from 'sentry/utils/platform';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {setActiveThreadId} from 'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails';

import type {IssueThreadStackTraceStore} from './threadStore';

interface IssueThreadStackTraceContextValue {
  event: Event;
  group: Group | undefined;
  hasMoreThanOneThread: boolean;
  hasScmSourceContext: boolean;
  projectSlug: Project['slug'];
  storageKey: string;
  threads: Thread[];
}

interface ActiveThreadContextValue {
  activeException: ExceptionValue | undefined;
  activeThread: Thread | undefined;
  exception: ReturnType<typeof getThreadException>;
  hasMinifiedStacktrace: boolean;
  minifiedStacktrace: StacktraceType | undefined;
  platform: Event['platform'];
  stacktrace: StacktraceType | undefined;
}

interface IssueThreadStackTraceProvidersProps {
  children: ReactNode;
  event: Event;
  group: Group | undefined;
  hasMoreThanOneThread: boolean;
  projectSlug: Project['slug'];
  threads: Thread[];
}

const IssueThreadStackTraceContext =
  createContext<IssueThreadStackTraceContextValue | null>(null);
const IssueThreadStackTraceStoreContext =
  createContext<IssueThreadStackTraceStore | null>(null);
const ActiveThreadContext = createContext<ActiveThreadContextValue | null>(null);

function getDefaultView(
  thread: Thread | undefined,
  exception: ReturnType<typeof getThreadException>
): StackTraceView {
  if (exception) {
    return exception.values.some(value => !!value.stacktrace?.hasSystemFrames)
      ? 'app'
      : 'full';
  }

  return thread?.stacktrace?.hasSystemFrames ? 'app' : 'full';
}

function getActiveExceptionValue({
  activeThread,
  exceptionValues,
}: {
  activeThread: Thread | undefined;
  exceptionValues: ExceptionValue[];
}): ExceptionValue | undefined {
  return (
    exceptionValues.find(value => value.threadId === activeThread?.id) ??
    exceptionValues[0]
  );
}

function getActiveStacktrace({
  activeException,
  activeThread,
}: {
  activeException: ExceptionValue | undefined;
  activeThread: Thread | undefined;
}): {
  minifiedStacktrace: StacktraceType | undefined;
  stacktrace: StacktraceType | undefined;
} {
  return {
    stacktrace: activeException?.stacktrace ?? activeThread?.stacktrace ?? undefined,
    minifiedStacktrace:
      activeException?.rawStacktrace ?? activeThread?.rawStacktrace ?? undefined,
  };
}

export function useIssueThreadStackTraceContext() {
  const context = useContext(IssueThreadStackTraceContext);
  if (!context) {
    throw new Error(
      'useIssueThreadStackTraceContext must be used within IssueThreadStackTrace'
    );
  }
  return context;
}

export function useIssueThreadStackTraceStore() {
  const store = useContext(IssueThreadStackTraceStoreContext);
  if (!store) {
    throw new Error(
      'useIssueThreadStackTraceStore must be used within IssueThreadStackTrace'
    );
  }
  return store;
}

export function useActiveThread() {
  const store = useIssueThreadStackTraceStore();
  return useSyncExternalStore(store.subscribe, store.getActiveThread);
}

export function useActiveThreadContext() {
  const context = useContext(ActiveThreadContext);
  if (!context) {
    throw new Error('useActiveThreadContext must be used within ActiveThreadProviders');
  }
  return context;
}

export function IssueThreadStackTraceStoreProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: IssueThreadStackTraceStore;
}) {
  return (
    <IssueThreadStackTraceStoreContext.Provider value={store}>
      {children}
    </IssueThreadStackTraceStoreContext.Provider>
  );
}

export function IssueThreadStackTraceProviders({
  children,
  event,
  group,
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

  const contextValue = useMemo<IssueThreadStackTraceContextValue>(
    () => ({
      event,
      group,
      hasMoreThanOneThread,
      hasScmSourceContext,
      projectSlug,
      storageKey,
      threads,
    }),
    [
      event,
      group,
      hasMoreThanOneThread,
      hasScmSourceContext,
      projectSlug,
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
  const activeThread = useActiveThread();
  const {event, hasScmSourceContext, storageKey} = useIssueThreadStackTraceContext();
  const [persistedOptions] = useNativeDisplayOptionsStorage(storageKey);
  const exception = useMemo(
    () => getThreadException(event, activeThread),
    [event, activeThread]
  );
  const activeException = useMemo(
    () =>
      getActiveExceptionValue({
        activeThread,
        exceptionValues: exception?.values ?? [],
      }),
    [activeThread, exception]
  );
  const {minifiedStacktrace, stacktrace} = useMemo(
    () => getActiveStacktrace({activeException, activeThread}),
    [activeException, activeThread]
  );
  const platform = inferPlatform(event, activeThread);
  const hasMinifiedStacktrace =
    !!activeThread?.rawStacktrace ||
    !!exception?.values.some(value => !!value.rawStacktrace);
  const {defaultIsMinified, defaultView} = getNativeDisplayOptionDefaults({
    defaultView: getDefaultView(activeThread, exception),
    hasMinifiedStacktrace,
    persistedOptions,
  });

  const contextValue = useMemo<ActiveThreadContextValue>(
    () => ({
      activeException,
      activeThread,
      exception,
      hasMinifiedStacktrace,
      minifiedStacktrace,
      platform,
      stacktrace,
    }),
    [
      activeException,
      activeThread,
      exception,
      hasMinifiedStacktrace,
      minifiedStacktrace,
      platform,
      stacktrace,
    ]
  );

  useEffect(() => {
    setActiveThreadId(activeThread?.id);
  }, [activeThread?.id]);

  return (
    <ActiveThreadContext.Provider value={contextValue}>
      <StackTraceViewStateProvider
        platform={platform}
        hasMinifiedStacktrace={hasMinifiedStacktrace}
        defaultView={defaultView}
        defaultIsMinified={defaultIsMinified}
        defaultIsNewestFirst={isStacktraceNewestFirst()}
      >
        {stacktrace && isNativePlatform(platform) ? (
          <NativeStackTraceProvider
            event={event}
            stacktrace={stacktrace}
            minifiedStacktrace={minifiedStacktrace}
            hasScmSourceContext={hasScmSourceContext}
            platform={platform}
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
