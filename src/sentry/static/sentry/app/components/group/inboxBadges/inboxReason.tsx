import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import DateTime from 'app/components/dateTime';
import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {InboxDetails} from 'app/types';

const GroupInboxReason = {
  NEW: 0,
  UNIGNORED: 1,
  REGRESSION: 2,
  MANUAL: 3,
  REPROCESSED: 4,
};

type Props = {
  inbox: InboxDetails;
  fontSize?: 'sm' | 'md';
};

function InboxReason({inbox, fontSize = 'sm'}: Props) {
  const {reason, reason_details, date_added: dateAdded} = inbox;

  function getReasonDetails(): {
    tagType: React.ComponentProps<typeof Tag>['type'];
    reasonBadgeText: string;
    tooltipText?: string;
  } {
    switch (reason) {
      case GroupInboxReason.UNIGNORED:
        return {
          tagType: 'default',
          reasonBadgeText: t('Unignored'),
          tooltipText: t('%(count)s events within %(window)s', {
            count: reason_details?.count || 0,
            window: moment.duration(reason_details?.window || 0, 'minutes').humanize(),
          }),
        };
      case GroupInboxReason.REGRESSION:
        return {
          tagType: 'error',
          reasonBadgeText: t('Regression'),
          tooltipText: t('Issue was resolved'),
        };
      case GroupInboxReason.MANUAL:
        return {
          tagType: 'highlight',
          reasonBadgeText: t('Manual'),
          // TODO(scttcper): Add tooltip text for a manual move
          // Moved to inbox by {full_name}.
        };
      case GroupInboxReason.REPROCESSED:
        return {
          tagType: 'info',
          reasonBadgeText: t('Reprocessed'),
          tooltipText: t('Issue was reprocessed'),
        };
      default:
        return {
          tagType: 'warning',
          reasonBadgeText: t('New Issue'),
        };
    }
  }

  const {tooltipText, reasonBadgeText, tagType} = getReasonDetails();

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
    <Tag type={tagType} tooltipText={tooltip}>
      <TextWrapper fontSize={fontSize}>{reasonBadgeText}</TextWrapper>
    </Tag>
  );
}

export default InboxReason;

const DateWrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const TextWrapper = styled('span')<{fontSize: 'sm' | 'md'}>`
  font-size: ${p =>
    p.fontSize === 'sm' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium};
`;
