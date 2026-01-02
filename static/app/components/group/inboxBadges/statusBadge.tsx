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
): {status: string; tagVariant: TagProps['variant']; tooltip?: string} | undefined {
  if (status === 'resolved') {
    return {
      tagVariant: 'info',
      status: t('Resolved'),
      tooltip: t('This issue was marked as fixed.'),
    };
  }
  if (status === 'unresolved') {
    if (substatus === GroupSubstatus.REGRESSED) {
      return {
        tagVariant: 'info',
        status: t('Regressed'),
        tooltip: t('This issue was resolved then occurred again.'),
      };
    }
    if (substatus === GroupSubstatus.ESCALATING) {
      return {
        tagVariant: 'danger',
        status: t('Escalating'),
        tooltip: t('This issue is occurring significantly more often than it used to.'),
      };
    }
    if (substatus === GroupSubstatus.NEW) {
      return {
        tagVariant: 'warning',
        status: t('New'),
        tooltip: t('This issue first occurred in the last 7 days.'),
      };
    }
    return {
      tagVariant: 'muted',
      status: t('Ongoing'),
      tooltip: t(
        'This issue was created more than 7 days ago or has manually been marked as reviewed.'
      ),
    };
  }
  if (status === 'ignored') {
    return {
      tagVariant: 'muted',
      status: t('Archived'),
      tooltip:
        substatus === GroupSubstatus.ARCHIVED_FOREVER
          ? t('Archived forever.')
          : substatus === GroupSubstatus.ARCHIVED_UNTIL_ESCALATING
            ? t('Archived until escalating.')
            : t('Archived until condition met.'),
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
      variant={badge.tagVariant}
      tooltip={badge.tooltip}
      fontSize={props.fontSize}
    >
      {badge.status}
    </GroupStatusTag>
  );
}
