import * as Sentry from '@sentry/react';

import {IconCheckmark, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ImageStatus} from 'sentry/types/debugImage';
import {unreachable} from 'sentry/utils/unreachable';

type Props = {
  status: ImageStatus;
};

export function getProcessingTooltip(status: ImageStatus): string | undefined {
  switch (status) {
    case ImageStatus.TIMEOUT:
    case ImageStatus.FETCHING_FAILED:
      return t('The debug information file for this image could not be downloaded');
    case ImageStatus.MALFORMED:
      return t('The debug information file for this image failed to process');
    case ImageStatus.MISSING:
      return t('No debug information could be found in any of the specified sources');
    case ImageStatus.FOUND:
      return t('Debug information for this image was found and successfully processed');
    case ImageStatus.UNUSED:
      return t('The image was not required for processing the stack trace');
    case ImageStatus.OTHER:
      return t('An internal error occurred while handling this image');
    case ImageStatus.UNSUPPORTED:
      return t(
        'The debug information file format is not supported or compatible with this event type'
      );
    default:
      unreachable(status);
      return undefined;
  }
}

function ProcessingIcon({status}: Props) {
  switch (status) {
    case ImageStatus.TIMEOUT:
    case ImageStatus.FETCHING_FAILED:
    case ImageStatus.MALFORMED:
    case ImageStatus.MISSING:
    case ImageStatus.OTHER:
    case ImageStatus.UNSUPPORTED:
      return <IconWarning variant="warning" size="xs" />;
    case ImageStatus.FOUND:
      return <IconCheckmark variant="success" size="xs" />;
    case ImageStatus.UNUSED:
      return <IconInfo variant="muted" size="xs" />;
    default: {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureException(new Error('Unknown image ProcessingIcon status'));
      });
      unreachable(status);
      return null;
    }
  }
}

export default ProcessingIcon;
