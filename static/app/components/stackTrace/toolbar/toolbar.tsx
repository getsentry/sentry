import {Flex} from '@sentry/scraps/layout';

import {DisplayOptions} from './displayOptions';
import {DownloadButton} from './downloadButton';

interface ToolbarProps {
  /**
   * When provided, a DownloadButton for native-platform crash reports will be shown
   * (only visible for native platforms when view === 'raw').
   */
  projectSlug?: string;
}

/**
 * Default stack trace toolbar. Renders DisplayOptions and an optional DownloadButton.
 *
 * CopyButton is intentionally not included here — compose it yourself if needed:
 *
 * ```tsx
 * <Flex justify="flex-end" gap="sm">
 *   <StackTraceProvider.DownloadButton projectSlug={slug} />
 *   <StackTraceProvider.DisplayOptions />
 *   <StackTraceProvider.CopyButton />
 * </Flex>
 * ```
 */
export function Toolbar({projectSlug}: ToolbarProps) {
  return (
    <Flex justify="flex-end" align="center" gap="sm" wrap="wrap" marginBottom="sm">
      {projectSlug && <DownloadButton projectSlug={projectSlug} />}
      <DisplayOptions />
    </Flex>
  );
}
