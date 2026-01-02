import * as Sentry from '@sentry/react';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconClose, IconWarning} from 'sentry/icons';
import type {CandidateProcessingInfo} from 'sentry/types/debugImage';
import {CandidateProcessingStatus} from 'sentry/types/debugImage';

type Props = {
  processingInfo: CandidateProcessingInfo;
};

function ProcessingIcon({processingInfo}: Props) {
  switch (processingInfo.status) {
    case CandidateProcessingStatus.OK:
      return <IconCheckmark variant="success" size="xs" />;
    case CandidateProcessingStatus.ERROR: {
      const {details} = processingInfo;
      return (
        <Tooltip title={details} disabled={!details}>
          <IconClose variant="danger" size="xs" />
        </Tooltip>
      );
    }
    case CandidateProcessingStatus.MALFORMED: {
      const {details} = processingInfo;
      return (
        <Tooltip title={details} disabled={!details}>
          <IconWarning color="yellow300" size="xs" />
        </Tooltip>
      );
    }
    default: {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureException(
          new Error('Unknown image candidate ProcessingIcon status')
        );
      });
      return null; // this shall never happen
    }
  }
}

export default ProcessingIcon;
