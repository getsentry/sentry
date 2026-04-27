import {createContext, useContext} from 'react';

import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';

export interface NativeStackTraceContextValue {
  /**
   * Render absolute instruction addresses instead of `+offset` from image
   * load address. User-toggleable via NativeDisplayOptions.
   */
  absoluteAddresses: boolean;
  /**
   * Render the absolute file path instead of the basename. User-toggleable
   * via NativeDisplayOptions.
   */
  absoluteFilePaths: boolean;
  /**
   * True when at least one frame has an `instructionAddr`. The
   * absoluteAddresses toggle is meaningless without one.
   */
  hasAbsoluteAddresses: boolean;
  /**
   * True when at least one frame has a filename and an absPath that differs
   * from it. The absoluteFilePaths toggle is meaningless otherwise.
   */
  hasAbsoluteFilePaths: boolean;
  /**
   * True when at least one frame in the stacktrace would render a
   * symbolication status icon (error or warning). Used to decide whether
   * to reserve the status column at all — frames stay aligned across rows.
   */
  hasAnyStatusIcons: boolean;
  /**
   * True when at least one frame has both `function` and a different
   * `rawFunction`. The verboseFunctionNames toggle is meaningless otherwise
   * and is disabled in the dropdown.
   */
  hasVerboseFunctionNames: boolean;
  /**
   * Map keyed by absolute frame index to its resolved debug image (if any).
   * Resolved once at the provider level so each frame row doesn't repeat the
   * `findImageForAddress` scan over the debug-meta entry.
   */
  imageByFrameIndex: Map<number, ImageWithCombinedStatus | null>;
  /**
   * Whether this stack trace is being rendered inside a hovercard preview;
   * frame rows use this to lengthen tooltip delays and disable navigation.
   */
  isHoverPreviewed: boolean;
  /**
   * Pad relative-address strings to this width so the address column lines
   * up across all rows. Computed once over every frame in the stacktrace.
   */
  maxLengthOfRelativeAddress: number;
  setAbsoluteAddresses: (value: boolean) => void;
  setAbsoluteFilePaths: (value: boolean) => void;
  setVerboseFunctionNames: (value: boolean) => void;
  /**
   * Render `frame.rawFunction` (mangled symbol) instead of the demangled
   * `frame.function` when both are present. User-toggleable via
   * NativeDisplayOptions.
   */
  verboseFunctionNames: boolean;
}

export const NativeStackTraceContext = createContext<NativeStackTraceContextValue | null>(
  null
);

export function useNativeStackTraceContext(): NativeStackTraceContextValue {
  const value = useContext(NativeStackTraceContext);
  if (!value) {
    throw new Error(
      'useNativeStackTraceContext must be used within NativeStackTraceProvider'
    );
  }
  return value;
}
