import * as Sentry from '@sentry/react';

import {IconCheckmark, IconClose, IconWarning} from 'sentry/icons';
import type {CandidateProcessingInfo} from 'sentry/types/debugImage';
import {CandidateProcessingStatus} from 'sentry/types/debugImage';

type Props = {
  processingInfo: CandidateProcessingInfo;
};

export function getProcessingInfoTooltip(
  processingInfo: CandidateProcessingInfo
): string | undefined {
  if (
    processingInfo.status === CandidateProcessingStatus.ERROR ||
    processingInfo.status === CandidateProcessingStatus.MALFORMED
  ) {
    return processingInfo.details;
  }
  return undefined;
}

function ProcessingIcon({processingInfo}: Props) {
  switch (processingInfo.status) {
    case CandidateProcessingStatus.OK:
      return <IconCheckmark variant="success" size="xs" />;
    case CandidateProcessingStatus.ERROR:
      return <IconClose variant="danger" size="xs" />;
    case CandidateProcessingStatus.MALFORMED:
      return <IconWarning variant="warning" size="xs" />;
    default: {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureException(
          new Error('Unknown image candidate ProcessingIcon status')
        );
      });
      return null;
    }
  }
}

export default ProcessingIcon;
