import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import Tag from 'app/components/tag';
import {getRelativeDate} from 'app/components/timeSince';
import {t, tct} from 'app/locale';
import {InboxDetails} from 'app/types';
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

  function getTooltipDescription() {
    const {until, count, window, user_count, user_window} = reason_details;
    if (until) {
      // Was ignored until `until` has passed.
      //`until` format: "2021-01-20T03:59:03+00:00"
      return tct('Was ignored until [window]', {
        window: <DateTime date={until} dateOnly />,
      });
    }

    if (count) {
      // Was ignored until `count` events occurred
      // If `window` is defined, than `count` events occurred in `window` minutes.
      // else `count` events occurred since it was ignored.
      if (window) {
        return tct('Was ignored until it occurred [count] time(s) in [duration]', {
          count: getCountText(count),
          duration: getDuration(window * 60, 0, true),
        });
      }

      return tct('Was ignored until it occurred [count] time(s)', {
        count: getCountText(count),
      });
    }

    if (user_count) {
      // Was ignored until `user_count` users were affected
      // If `user_window` is defined, than `user_count` users affected in `user_window` minutes.
      // else `user_count` events occurred since it was ignored.
      if (user_window) {
        return t('Was ignored until it affected [count] user(s) in [duration]', {
          count: getCountText(user_count),
          duration: getDuration(user_window * 60, 0, true),
        });
      }
      return t('Was ignored until it affected [count] user(s)', {
        count: getCountText(user_count),
      });
    }

    return undefined;
  }

  function getReasonDetails(): {
    tagType: React.ComponentProps<typeof Tag>['type'];
    reasonBadgeText: string;
    tooltipText?: string;
    tooltipDescription?: string | React.ReactElement;
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
          tooltipDescription: getTooltipDescription(),
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
      <TooltipDescription>Mark Reviewed to remove this label</TooltipDescription>
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

const StyledTag = styled(Tag, {
  shouldForwardProp: p => isPropValid(p) && p !== 'fontSize',
})<{fontSize: 'sm' | 'md'}>`
  font-size: ${p =>
    p.fontSize === 'sm' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium};
`;
