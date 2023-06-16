import type {Theme} from '@emotion/react';

import {GroupStatusTag} from 'sentry/components/group/inboxBadges/groupStatusTag';
import {t} from 'sentry/locale';
import {Group, GroupSubstatus} from 'sentry/types';

interface SubstatusBadgeProps {
  status: Group['status'];
  fontSize?: 'sm' | 'md';
  substatus?: Group['substatus'];
}

function getBadgeProperties(
  status: Group['status'],
  substatus: Group['substatus']
): {status: string; tagType: keyof Theme['tag']; tooltip?: string} | undefined {
  if (status === 'resolved') {
    return {
      tagType: 'highlight',
      status: t('Resolved'),
    };
  }
  if (status === 'unresolved') {
    if (substatus === GroupSubstatus.REGRESSED) {
      return {
        tagType: 'highlight',
        status: t('Regressed'),
      };
    }
    if (substatus === GroupSubstatus.ESCALATING) {
      return {
        tagType: 'error',
        status: t('Escalating'),
      };
    }
    if (substatus === GroupSubstatus.NEW) {
      return {
        tagType: 'warning',
        status: t('New'),
      };
    }
    return {
      tagType: 'default',
      status: t('Ongoing'),
    };
  }
  if (status === 'ignored') {
    return {
      tagType: 'default',
      status: t('Archived'),
      tooltip:
        substatus === GroupSubstatus.ARCHIVED_FOREVER
          ? t('Archived forever')
          : substatus === GroupSubstatus.ARCHIVED_UNTIL_ESCALATING
          ? t('Archived until escalating')
          : t('Archived until condition met'),
    };
  }
  return undefined;
}

/**
 * A replacement for the inbox badge that uses the group substatus
 * instead of the group inbox reason.
 */
export function GroupStatusBadge(props: SubstatusBadgeProps) {
  const badge = getBadgeProperties(props.status, props.substatus);
  if (!badge) {
    return null;
  }

  return (
    <GroupStatusTag
      type={badge.tagType}
      tooltip={badge.tooltip}
      fontSize={props.fontSize}
    >
      {badge.status}
    </GroupStatusTag>
  );
}
