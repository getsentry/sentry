import * as Sentry from '@sentry/react';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ImageStatus} from 'sentry/types/debugImage';

type Props = {
  status: ImageStatus;
};

function ProcessingIcon({status}: Props) {
  switch (status) {
    case ImageStatus.TIMEOUT:
    case ImageStatus.FETCHING_FAILED: {
      return (
        <Tooltip
          skipWrapper
          title={t('The debug information file for this image could not be downloaded')}
        >
          <IconWarning variant="warning" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.MALFORMED: {
      return (
        <Tooltip
          skipWrapper
          title={t('The debug information file for this image failed to process')}
        >
          <IconWarning variant="warning" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.MISSING: {
      return (
        <Tooltip
          skipWrapper
          title={t('No debug information could be found in any of the specified sources')}
        >
          <IconWarning variant="warning" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.FOUND: {
      return (
        <Tooltip
          skipWrapper
          title={t(
            'Debug information for this image was found and successfully processed'
          )}
        >
          <IconCheckmark variant="success" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.UNUSED: {
      return (
        <Tooltip
          skipWrapper
          title={t('The image was not required for processing the stack trace')}
        >
          <IconInfo variant="muted" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.OTHER: {
      return (
        <Tooltip
          skipWrapper
          title={t('An internal error occurred while handling this image')}
        >
          <IconWarning variant="warning" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.UNSUPPORTED: {
      // UNSUPPORTED status occurs in two scenarios:
      // 1. Relay filters out debug images with completely unknown/unrecognized types during event normalization
      // 2. Symbolicator finds a debug file but it's incompatible with the event type
      //    (e.g., trying to symbolicate .NET events with Windows PDB files)
      return (
        <Tooltip
          skipWrapper
          title={t(
            'The debug information file format is not supported or compatible with this event type'
          )}
        >
          <IconWarning variant="warning" size="xs" />
        </Tooltip>
      );
    }
    default: {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureException(new Error('Unknown image ProcessingIcon status'));
      });
      return null; // This shall not happen
    }
  }
}

export default ProcessingIcon;
