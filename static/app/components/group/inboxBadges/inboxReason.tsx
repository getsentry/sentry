import * as React from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Tag from 'sentry/components/tag';
import TimeSince, {getRelativeDate} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {InboxDetails} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {Theme} from 'sentry/utils/theme';

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
  /** Displays the time an issue was added to inbox */
  showDateAdded?: boolean;
};

const EVENT_ROUND_LIMIT = 1000;

function InboxReason({inbox, fontSize = 'sm', showDateAdded}: Props) {
  const {reason, reason_details: reasonDetails, date_added: dateAdded} = inbox;
  const relativeDateAdded = getDynamicText({
    value: dateAdded && getRelativeDate(dateAdded, 'ago', true),
    fixed: '3s ago',
  });

  const getCountText = (count: number) =>
    count > EVENT_ROUND_LIMIT
      ? `More than ${Math.round(count / EVENT_ROUND_LIMIT)}k`
      : `${count}`;

  function getTooltipDescription() {
    const {
      until,
      count,
      window,
      user_count: userCount,
      user_window: userWindow,
    } = reasonDetails;
    if (until) {
      // Was ignored until `until` has passed.
      // `until` format: "2021-01-20T03:59:03+00:00"
      return tct('Was ignored until [window]', {
        window: <DateTime date={until} dateOnly />,
      });
    }

    if (count) {
      // Was ignored until `count` events occurred
      // If `window` is defined, than `count` events occurred in `window` minutes.
      // else `count` events occurred since it was ignored.
      if (window) {
        return tct('Occurred [count] time(s) in [duration]', {
          count: getCountText(count),
          duration: getDuration(window * 60, 0, true),
        });
      }

      return tct('Occurred [count] time(s)', {
        count: getCountText(count),
      });
    }

    if (userCount) {
      // Was ignored until `user_count` users were affected
      // If `user_window` is defined, than `user_count` users affected in `user_window` minutes.
      // else `user_count` events occurred since it was ignored.
      if (userWindow) {
        return tct('Affected [count] user(s) in [duration]', {
          count: getCountText(userCount),
          duration: getDuration(userWindow * 60, 0, true),
        });
      }
      return tct('Affected [count] user(s)', {
        count: getCountText(userCount),
      });
    }

    return undefined;
  }

  function getReasonDetails(): {
    reasonBadgeText: string;
    tagType: React.ComponentProps<typeof Tag>['type'];
    tooltipDescription?: string | React.ReactNode;
    tooltipText?: string;
  } {
    switch (reason) {
      case GroupInboxReason.UNIGNORED:
        return {
          tagType: 'default',
          reasonBadgeText: t('Unignored'),
          tooltipText:
            dateAdded &&
            t('Unignored %(relative)s', {
              relative: relativeDateAdded,
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
              relative: relativeDateAdded,
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
            dateAdded && t('Moved %(relative)s', {relative: relativeDateAdded}),
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
              relative: relativeDateAdded,
            }),
        };
      case GroupInboxReason.NEW:
      default:
        return {
          tagType: 'warning',
          reasonBadgeText: t('New Issue'),
          tooltipText:
            dateAdded &&
            t('Created %(relative)s', {
              relative: relativeDateAdded,
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
      {showDateAdded && dateAdded && (
        <React.Fragment>
          <Separator type={tagType ?? 'default'}>{' | '}</Separator>
          <TimeSince date={dateAdded} suffix="" extraShort disabledAbsoluteTooltip />
        </React.Fragment>
      )}
    </StyledTag>
  );
}

export default InboxReason;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const TooltipDescription = styled('div')`
  color: ${p => p.theme.subText};
`;

const Separator = styled('span')<{type: keyof Theme['tag']}>`
  color: ${p => p.theme.tag[p.type].border};
  opacity: 80%;
`;

const StyledTag = styled(Tag, {
  shouldForwardProp: p => p !== 'fontSize',
})<{fontSize: 'sm' | 'md'}>`
  font-size: ${p =>
    p.fontSize === 'sm' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium};
`;
