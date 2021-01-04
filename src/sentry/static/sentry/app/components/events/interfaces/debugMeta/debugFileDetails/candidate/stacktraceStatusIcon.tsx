import React from 'react';

import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconClose, IconWarning} from 'app/icons';
import {CandidateStacktraceInfo, CandidateStacktraceStatus} from 'app/types/debugImage';

type Props = {
  stacktraceInfo: CandidateStacktraceInfo;
};

function StacktraceStatusIcon({stacktraceInfo}: Props) {
  switch (stacktraceInfo.status) {
    case CandidateStacktraceStatus.OK:
      return <IconCheckmark color="green300" size="xs" />;
    case CandidateStacktraceStatus.ERROR: {
      const {details} = stacktraceInfo;
      return (
        <Tooltip title={details} disabled={!details}>
          <IconClose color="red300" size="xs" />
        </Tooltip>
      );
    }
    case CandidateStacktraceStatus.MALFORMED: {
      const {details} = stacktraceInfo;
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

export default StacktraceStatusIcon;
