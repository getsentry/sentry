import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {InboxDetails} from 'app/types';
import {getDuration} from 'app/utils/formatters';
import {getRelativeDate} from 'app/components/timeSince';

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

  const getCountText = (count: number) => count > 1000 ? `More than ${Math.round(count / 1000)}k` : `${count}`;

  function getReasonDetails(): {
    tagType: React.ComponentProps<typeof Tag>['type'];
    reasonBadgeText: string;
    tooltipText?: string;
    tooltipDescription?: string;
  } {
    switch (reason) {
      case GroupInboxReason.UNIGNORED:
        return {
          tagType: 'default',
          reasonBadgeText: t('Unignored'),
          tooltipText: dateAdded && t('Unignored %(relative)s', {relative: getRelativeDate(dateAdded, 'ago', true)}),
          tooltipDescription: t('%(count)s events in %(window)s', {
            count: getCountText(reason_details?.count || 0),
            window: getDuration((reason_details?.window || 0) * 60, 0, true),
          }),
        };
      case GroupInboxReason.REGRESSION:
        return {
          tagType: 'error',
          reasonBadgeText: t('Regression'),
          tooltipText: dateAdded && t('Regressed %(relative)s', {relative: getRelativeDate(dateAdded, 'ago', true)}),
          // TODO: Add tooltip description for regression move when resolver is added to reason
          // Resolved by {full_name} {time} ago.
        };
      // TODO: Manual moves will go away, remove this then
      case GroupInboxReason.MANUAL:
        return {
          tagType: 'highlight',
          reasonBadgeText: t('Manual'),
          tooltipText: dateAdded && t('Moved %(relative)s', {relative: getRelativeDate(dateAdded, 'ago', true)}),
          // TODO: IF manual moves stay then add tooltip description for manual move
          // Moved to inbox by {full_name}.
        };
      case GroupInboxReason.REPROCESSED:
        return {
          tagType: 'info',
          reasonBadgeText: t('Reprocessed'),
          tooltipText: dateAdded && t('Reprocessed %(relative)s', {relative: getRelativeDate(dateAdded, 'ago', true)}),
        };
      default:
        return {
          tagType: 'warning',
          reasonBadgeText: t('New Issue'),
          tooltipText: dateAdded && t('Created %(relative)s', {relative: getRelativeDate(dateAdded, 'ago', true)}),
        };
    }
  }

  const {tooltipText, tooltipDescription, reasonBadgeText, tagType} = getReasonDetails();

  const tooltip = (
    <TooltipWrapper>
      {tooltipText && <div>{tooltipText}</div>}
      {tooltipDescription && (
        <TooltipDescription>{tooltipDescription}</TooltipDescription>
      )}
    </TooltipWrapper>
  );

  return (
    <StyledTag type={tagType} tooltipText={tooltip} fontSize={fontSize}>
      {reasonBadgeText}
    </StyledTag>
  );
}

export default InboxReason;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const TooltipDescription = styled('div')`
  color: ${p => p.theme.gray200};
`;

const StyledTag = styled(Tag)<{fontSize: 'sm' | 'md'}>`
  font-size: ${p =>
    p.fontSize === 'sm' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium};
`;
