import React from 'react';

import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconClose, IconWarning} from 'app/icons';
import {CandidateProcessingInfo, CandidateProcessingStatus} from 'app/types/debugImage';

type Props = {
  processingInfo: CandidateProcessingInfo;
};

function ProcessingIcon({processingInfo}: Props) {
  switch (processingInfo.status) {
    case CandidateProcessingStatus.OK:
      return <IconCheckmark color="green300" size="xs" />;
    case CandidateProcessingStatus.ERROR: {
      const {details} = processingInfo;
      return (
        <Tooltip title={details} disabled={!details}>
          <IconClose color="red300" size="xs" />
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
    default:
      return null; //this should never happen
  }
}

export default ProcessingIcon;
