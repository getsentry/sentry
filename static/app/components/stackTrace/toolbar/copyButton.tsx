import {useContext} from 'react';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {StackTraceContext} from 'sentry/components/stackTrace/stackTraceContext';

interface CopyButtonProps {
  /** Override the default raw stack trace text that gets copied. */
  getCopyText?: () => string;
}

/**
 * Copy-as dropdown for the raw stack trace content.
 * Reads stacktrace and event from the nearest StackTraceContext.
 * Pass getCopyText to override the default raw content.
 * Returns null when used outside stack trace context and no getCopyText is provided.
 */
export function CopyButton({getCopyText}: CopyButtonProps) {
  const stackTraceContext = useContext(StackTraceContext);
  const contextCopyText =
    stackTraceContext &&
    (() =>
      rawStacktraceContent({
        data: stackTraceContext.stacktrace,
        platform: stackTraceContext.event.platform,
      }));

  const getText = getCopyText ?? contextCopyText;
  if (!getText) {
    return null;
  }

  return (
    <CopyAsDropdown
      size="xs"
      items={CopyAsDropdown.makeDefaultCopyAsOptions({
        text: getText,
        json: undefined,
        markdown: undefined,
      })}
    />
  );
}
