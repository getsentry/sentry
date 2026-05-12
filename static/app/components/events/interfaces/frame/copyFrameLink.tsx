import type {MouseEvent} from 'react';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Frame} from 'sentry/types/event';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

const DEFAULT_BUTTON_SIZE = 'xs';

interface CopyFrameLinkProps {
  frame: Partial<Pick<Frame, 'filename' | 'lineNo'>>;
  analyticsParams?: ButtonProps['analyticsParams'];
}

export function CopyFrameLink({analyticsParams, frame}: CopyFrameLinkProps) {
  const filePath =
    frame.filename && frame.lineNo !== null && frame.lineNo !== undefined
      ? `${frame.filename}:${frame.lineNo}`
      : frame.filename || '';

  const {copy} = useCopyToClipboard();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    // Strip away relative path segments to make it easier for editors to actually find the file (like VSCode cmd+p)
    const cleanedFilepath = filePath.replace(/^(\.\/)?(\.\.\/)*/g, '');

    copy(cleanedFilepath, {
      successMessage: t('File path copied to clipboard'),
      errorMessage: t('Failed to copy file path'),
    });
  };

  // Don't render if there's no valid file path to copy
  if (!filePath) {
    return null;
  }

  return (
    <Tooltip title={t('Copy file path')} skipWrapper>
      <Button
        size={DEFAULT_BUTTON_SIZE}
        variant="transparent"
        aria-label={t('Copy file path')}
        icon={<IconCopy />}
        onClick={handleClick}
        {...(analyticsParams
          ? {
              analyticsEventKey: 'stacktrace_link_copy_file_path',
              analyticsEventName: 'Stacktrace Link Copy File Path',
              analyticsParams,
            }
          : {})}
      />
    </Tooltip>
  );
}
