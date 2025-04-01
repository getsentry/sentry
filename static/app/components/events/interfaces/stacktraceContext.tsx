import {createContext, useContext, useState} from 'react';

import {StackType, StackView} from 'sentry/types/stacktrace';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

type DisplayOptions =
  | 'absolute-addresses'
  | 'absolute-file-paths'
  | 'minified'
  | 'raw-stack-trace'
  | 'verbose-function-names';

interface IssueStacktraceContextType {
  /**
   * Display options for the stack trace
   */
  displayOptions: DisplayOptions[];
  /**
   * Display full stack trace or filter to relevant frames
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

export const IssueStacktraceContext = createContext<IssueStacktraceContextType>({
  stackView: StackView.APP,
  stackType: StackType.ORIGINAL,
  displayOptions: [],
  setDisplayOptions: () => {},
  isFullStackTrace: true,
  setIsFullStackTrace: () => {},
  isNewestFramesFirst: true,
  setIsNewestFramesFirst: () => {},
});

interface StacktraceEntrypointProps {
  children: React.ReactNode;
  hasFullStackTrace: boolean;
  hasSystemFrames: boolean;
  projectSlug: string;
}

export function StacktraceContext({
  children,
  projectSlug,
  hasSystemFrames,
  hasFullStackTrace,
}: StacktraceEntrypointProps) {
  const organization = useOrganization();
  const [isFullStackTrace, setIsFullStackTrace] = useState(() => hasFullStackTrace);
  const [isNewestFramesFirst, setIsNewestFramesFirst] = useState(true);

  const [displayOptions, setDisplayOptions] = useLocalStorageState<DisplayOptions[]>(
    `issue-details-stracktrace-display-${organization.slug}-${projectSlug}`,
    []
  );

  const stackView = displayOptions.includes('raw-stack-trace')
    ? StackView.RAW
    : isFullStackTrace
      ? StackView.FULL
      : StackView.APP;

  const stackType =
    hasSystemFrames && displayOptions.includes('minified')
      ? StackType.MINIFIED
      : StackType.ORIGINAL;

  return (
    <IssueStacktraceContext.Provider
      value={{
        isFullStackTrace,
        setIsFullStackTrace,
        isNewestFramesFirst,
        setIsNewestFramesFirst,
        displayOptions,
        setDisplayOptions,
        stackView,
        stackType,
      }}
    >
      {children}
    </IssueStacktraceContext.Provider>
  );
}

export function useStacktraceContext() {
  return useContext(IssueStacktraceContext);
}
