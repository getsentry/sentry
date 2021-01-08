import React from 'react';

import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconInfo, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {ImageProcessingInfo} from 'app/types/debugImage';

type Props = {
  status: ImageProcessingInfo;
};

function ProcessingIcon({status}: Props) {
  switch (status) {
    case ImageProcessingInfo.TIMEOUT:
    case ImageProcessingInfo.FETCHING_FAILED: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('The debug information file for this image could not be downloaded')}
        >
          <IconWarning color="yellow300" size="xs" />
        </Tooltip>
      );
    }
    case ImageProcessingInfo.MALFORMED: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('The debug information file for this image failed to process')}
        >
          <IconWarning color="yellow300" size="xs" />
        </Tooltip>
      );
    }
    case ImageProcessingInfo.MISSING: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('No debug information could be found in any of the specified sources')}
        >
          <IconWarning color="yellow300" size="xs" />
        </Tooltip>
      );
    }
    case ImageProcessingInfo.FOUND: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t(
            'Debug information for this image was found and successfully processed'
          )}
        >
          <IconCheckmark color="green300" size="xs" />
        </Tooltip>
      );
    }
    case ImageProcessingInfo.UNUSED: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('The image was not required for processing the stack trace')}
        >
          <IconInfo color="gray200" size="xs" />
        </Tooltip>
      );
    }
    case ImageProcessingInfo.OTHER: {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t('An internal error occurred while handling this image')}
        >
          <IconWarning color="yellow300" size="xs" />
        </Tooltip>
      );
    }
    default:
      return null; // This should not happen
  }
}

export default ProcessingIcon;
