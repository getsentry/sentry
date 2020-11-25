import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import DateTime from 'app/components/dateTime';
import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {InboxDetails} from 'app/types';

const GroupInboxReason = {
  NEW: 0,
  UNIGNORED: 1,
  REGRESSION: 2,
  MANUAL: 3,
};

type Props = {
  inbox: InboxDetails;
};

const InboxReason = ({inbox}: Props) => {
  const {reason, reason_details, date_added: dateAdded} = inbox;

  let reasonBadgeText: string;
  let tooltipText: string | undefined;
  let tagType: React.ComponentProps<typeof Tag>['type'];

  if (reason === GroupInboxReason.UNIGNORED) {
    reasonBadgeText = t('Unignored');
    tooltipText = t('%(count)s events within %(window)s', {
      count: reason_details?.count || 0,
      window: moment.duration(reason_details?.window || 0, 'minutes').humanize(),
    });
  } else if (reason === GroupInboxReason.REGRESSION) {
    tagType = 'error';
    reasonBadgeText = t('Regression');
    tooltipText = t('Issue was resolved.');
  } else if (reason === GroupInboxReason.MANUAL) {
    tagType = 'highlight';
    reasonBadgeText = t('Manual');
    // TODO(scttcper): Add tooltip text for a manual move
    // Moved to inbox by {full_name}.
  } else {
    tagType = 'warning';
    reasonBadgeText = t('New Issue');
  }

  const tooltip = (
    <TooltipWrapper>
      {tooltipText && <div>{tooltipText}</div>}
      {dateAdded && (
        <DateWrapper>
          <DateTime date={dateAdded} />
        </DateWrapper>
      )}
    </TooltipWrapper>
  );

  return (
    <Tooltip title={tooltip}>
      <Tag type={tagType}>{reasonBadgeText}</Tag>
    </Tooltip>
  );
};

export default InboxReason;

const DateWrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;

const TooltipWrapper = styled('div')`
  text-align: left;
`;
