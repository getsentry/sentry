import * as Sentry from '@sentry/react';

import Tooltip from 'sentry/components/tooltip';
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
          containerDisplayMode="inline-flex"
          title={t('The debug information file for this image could not be downloaded')}
        >
          <IconWarning color="warningText" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.MALFORMED: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('The debug information file for this image failed to process')}
        >
          <IconWarning color="warningText" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.MISSING: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('No debug information could be found in any of the specified sources')}
        >
          <IconWarning color="warningText" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.FOUND: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t(
            'Debug information for this image was found and successfully processed'
          )}
        >
          <IconCheckmark color="successText" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.UNUSED: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('The image was not required for processing the stack trace')}
        >
          <IconInfo color="subText" size="xs" />
        </Tooltip>
      );
    }
    case ImageStatus.OTHER: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('An internal error occurred while handling this image')}
        >
          <IconWarning color="warningText" size="xs" />
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
