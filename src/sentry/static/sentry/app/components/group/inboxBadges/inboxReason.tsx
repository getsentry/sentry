import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import {getRelativeDate} from 'app/components/timeSince';
import {t} from 'app/locale';
import {InboxDetails, InboxReasonDetails} from 'app/types';
import {getFormattedDate} from 'app/utils/dates';
import {getDuration} from 'app/utils/formatters';

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

const EVENT_ROUND_LIMIT = 1000;

function InboxReason({inbox, fontSize = 'sm'}: Props) {
  const {reason, reason_details, date_added: dateAdded} = inbox;

  const getCountText = (count: number) =>
    count > EVENT_ROUND_LIMIT
      ? `More than ${Math.round(count / EVENT_ROUND_LIMIT)}k`
      : `${count}`;

  function getTooltipDescription({
    until,
    count,
    window,
    user_count,
    user_window,
  }: InboxReasonDetails) {
    if (until) {
      // Was ignored until `until` has passed.
      //`until` format: "2021-01-20T03:59:03+00:00"
      return t('Was ignored until %(window)s', {
        until: getFormattedDate(until, 'YYYY/MM/DD HH:mm:ss', {local: true}),
      });
    }

    if (count) {
      // Was ignored until `count` events occurred
      // If `window` is defined, than `count` events occurred in `window` minutes.
      // else `count` events occurred since it was ignored.
      return t('Was ignored until it occurred %(count)s time(s)%(window)s', {
        count: getCountText(count || 0),
        window: window ? ' in ' + getDuration((window || 0) * 60, 0, true) : '',
      });
    }

    if (user_count) {
      // Was ignored until `user_count` users were affected
      // If `user_window` is defined, than `user_count` users affected in `user_window` minutes.
      // else `user_count` events occurred since it was ignored.
      return t('Was ignored until it affected %(user_count)s user(s)%(user_window)s', {
        user_count: getCountText(user_count || 0),
        user_window: user_window
          ? ' in ' + getDuration((user_window || 0) * 60, 0, true)
          : '',
      });
    }

    return undefined;
  }

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
          tooltipText:
            dateAdded &&
            t('Unignored %(relative)s', {
              relative: getRelativeDate(dateAdded, 'ago', true),
            }),
          tooltipDescription: getTooltipDescription(reason_details),
        };
      case GroupInboxReason.REGRESSION:
        return {
          tagType: 'error',
          reasonBadgeText: t('Regression'),
          tooltipText:
            dateAdded &&
            t('Regressed %(relative)s', {
              relative: getRelativeDate(dateAdded, 'ago', true),
            }),
          // TODO: Add tooltip description for regression move when resolver is added to reason
          // Resolved by {full_name} {time} ago.
        };
      // TODO: Manual moves will go away, remove this then
      case GroupInboxReason.MANUAL:
        return {
          tagType: 'highlight',
          reasonBadgeText: t('Manual'),
          tooltipText:
            dateAdded &&
            t('Moved %(relative)s', {relative: getRelativeDate(dateAdded, 'ago', true)}),
          // TODO: IF manual moves stay then add tooltip description for manual move
          // Moved to inbox by {full_name}.
        };
      case GroupInboxReason.REPROCESSED:
        return {
          tagType: 'info',
          reasonBadgeText: t('Reprocessed'),
          tooltipText:
            dateAdded &&
            t('Reprocessed %(relative)s', {
              relative: getRelativeDate(dateAdded, 'ago', true),
            }),
        };
      default:
        return {
          tagType: 'warning',
          reasonBadgeText: t('New Issue'),
          tooltipText:
            dateAdded &&
            t('Created %(relative)s', {
              relative: getRelativeDate(dateAdded, 'ago', true),
            }),
        };
    }
  }

  const {tooltipText, tooltipDescription, reasonBadgeText, tagType} = getReasonDetails();

  const tooltip = (tooltipText || tooltipDescription) && (
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
