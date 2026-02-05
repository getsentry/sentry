import {createContext, useContext, useMemo, useState} from 'react';

import {StackType, StackView} from 'sentry/types/stacktrace';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

type DisplayOptions =
  | 'absolute-addresses'
  | 'absolute-file-paths'
  | 'minified'
  | 'raw-stack-trace'
  | 'verbose-function-names'
  | 'flamegraph-view';

interface StackTraceContextOptions {
  children: React.ReactNode;
  /**
   * Whether the stack trace has system frames.
   * Removes the minified option if false.
   */
  hasSystemFrames: boolean;
  projectSlug: string;
  /**
   * Override the default newest frames first
   * @default true
   */
  defaultIsNewestFramesFirst?: boolean;
  /**
   * Override any options and force the stack trace to be full
   * @default false
   */
  forceFullStackTrace?: boolean;
  /**
   * Whether the stack trace has flamegraph data (parent_index fields).
   * When true, forces flamegraph view.
   * @default false
   */
  hasFlamegraphData?: boolean;
}

interface StacktraceContextType {
  /**
   * Display options for the stack trace
   */
  displayOptions: DisplayOptions[];
  /**
   * Prefer using the stackView prop instead.
   * This should only be used to control the full/relevant toggle.
   */
  forceFullStackTrace: boolean;
  /**
   * Display full stack trace or filter to relevant frames.
   * This should only be used to control the full/relevant toggle.
   * @default false
   */
  isFullStackTrace: boolean;
  /**
   * Sort frames by either recent first or recent last
   * @default true
   */
  isNewestFramesFirst: boolean;
  /**
   * Update display options
   */
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions[]>>;
  /**
   * Toggle the filter to either relevant or full stack trace
   */
  setIsFullStackTrace: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * Toggle the sort to either recent first or recent last
   */
  setIsNewestFramesFirst: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * The type of stack trace to display
   */
  stackType: StackType;
  /**
   * Derrived from display options
   */
  stackView: StackView;
}

const IssueStacktraceContext = createContext<StacktraceContextType>({
  stackView: StackView.APP,
  stackType: StackType.ORIGINAL,
  displayOptions: [],
  setDisplayOptions: () => {},
  isFullStackTrace: true,
  forceFullStackTrace: false,
  setIsFullStackTrace: () => {},
  isNewestFramesFirst: true,
  setIsNewestFramesFirst: () => {},
});

export function StacktraceContext({
  children,
  projectSlug,
  hasSystemFrames,
  forceFullStackTrace = false,
  defaultIsNewestFramesFirst = true,
  hasFlamegraphData = false,
}: StackTraceContextOptions) {
  const organization = useOrganization();
  const [isFullStackTrace, setIsFullStackTrace] = useState(false);
  const [isNewestFramesFirst, setIsNewestFramesFirst] = useState(
    defaultIsNewestFramesFirst
  );

  const [displayOptions, setDisplayOptions] = useLocalStorageState<DisplayOptions[]>(
    `issue-details-stracktrace-display-${organization.slug}-${projectSlug}`,
    []
  );

  // When hasFlamegraphData is true, always show flamegraph view
  const stackView = hasFlamegraphData
    ? StackView.FLAMEGRAPH
    : displayOptions.includes('raw-stack-trace')
      ? StackView.RAW
      : isFullStackTrace || forceFullStackTrace
        ? StackView.FULL
        : StackView.APP;

  const stackType =
    hasSystemFrames && displayOptions.includes('minified')
      ? StackType.MINIFIED
      : StackType.ORIGINAL;

  const value = useMemo(
    (): StacktraceContextType => ({
      isFullStackTrace: isFullStackTrace || forceFullStackTrace,
      setIsFullStackTrace,
      isNewestFramesFirst,
      setIsNewestFramesFirst,
      displayOptions,
      setDisplayOptions,
      stackView,
      stackType,
      forceFullStackTrace,
    }),
    [
      isFullStackTrace,
      forceFullStackTrace,
      isNewestFramesFirst,
      displayOptions,
      setDisplayOptions,
      stackView,
      stackType,
    ]
  );

  return (
    <IssueStacktraceContext.Provider value={value}>
      {children}
    </IssueStacktraceContext.Provider>
  );
}

export function useStacktraceContext() {
  return useContext(IssueStacktraceContext);
}
