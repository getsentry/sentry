import type {TagProps} from 'sentry/components/core/badge/tag';
import {GroupStatusTag} from 'sentry/components/group/inboxBadges/groupStatusTag';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {GroupSubstatus} from 'sentry/types/group';

interface SubstatusBadgeProps {
  status: Group['status'];
  fontSize?: 'sm' | 'md';
  substatus?: Group['substatus'];
}

export function getBadgeProperties(
  status: Group['status'],
  substatus: Group['substatus']
): {status: string; tagType: TagProps['type']; tooltip?: string} | undefined {
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
