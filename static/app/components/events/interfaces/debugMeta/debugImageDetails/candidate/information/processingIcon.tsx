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
      return <IconCheckmark color="successText" size="xs" />;
    case CandidateProcessingStatus.ERROR: {
      const {details} = processingInfo;
      return (
        <Tooltip title={details} disabled={!details}>
          <IconClose color="dangerText" size="xs" />
        </Tooltip>
      );
    }
    case CandidateProcessingStatus.MALFORMED: {
      const {details} = processingInfo;
      return (
        <Tooltip title={details} disabled={!details}>
          <IconWarning color="warningText" size="xs" />
        </Tooltip>
      );
    }
  }
}

export default ProcessingIcon;
