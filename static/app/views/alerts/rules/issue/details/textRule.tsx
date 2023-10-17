import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {Member, Team} from 'sentry/types';
import {
  IssueAlertActionType,
  IssueAlertConditionType,
  type IssueAlertRule,
} from 'sentry/types/alerts';
import useOrganization from 'sentry/utils/useOrganization';
import {AlertRuleComparisonType} from 'sentry/views/alerts/rules/metric/types';
import {CHANGE_ALERT_PLACEHOLDERS_LABELS} from 'sentry/views/alerts/utils/constants';

/**
 * Translate Issue Alert Conditions to text
 */
export function TextCondition({
  condition,
}: {
  condition: IssueAlertRule['conditions'][number];
}) {
  const organization = useOrganization();

  if (
    condition.id === IssueAlertConditionType.EVENT_FREQUENCY_PERCENT ||
    condition.id === IssueAlertConditionType.EVENT_FREQUENCY ||
    condition.id === IssueAlertConditionType.EVENT_UNIQUE_USER_FREQUENCY
  ) {
    const subject = CHANGE_ALERT_PLACEHOLDERS_LABELS[condition.id];
    if (condition.comparisonType === AlertRuleComparisonType.PERCENT) {
      // This text does not translate well and should match the alert builder
      return (
        <Fragment>
          {subject} {condition.value}% higher in {condition.interval} compared to{' '}
          {condition.comparisonInterval} ago
        </Fragment>
      );
    }

    return (
      // This text does not translate well and should match the alert builder
      <Fragment>
        {subject} more than {condition.value} in {condition.interval}
      </Fragment>
    );
  }

  if (
    condition.id === IssueAlertConditionType.REAPPEARED_EVENT &&
    organization.features.includes('escalating-issues')
  ) {
    return (
      <Fragment>{t('The issue changes state from archived to escalating')}</Fragment>
    );
  }
  return <Fragment>{condition.name}</Fragment>;
}

// TODO(scttcper): Remove the teams/memberList prop drilling
export function TextAction({
  action,
  memberList,
  teams,
}: {
  action: IssueAlertRule['actions'][number];
  memberList: Member[];
  teams: Team[];
}) {
  if (action.targetType === 'Member') {
    const user = memberList.find(
      member => member.user?.id === `${action.targetIdentifier}`
    );
    return (
      <Fragment>{t('Send a notification to %s', user?.email ?? t('unknown'))}</Fragment>
    );
  }

  if (action.targetType === 'Team') {
    const team = teams.find(tm => tm.id === `${action.targetIdentifier}`);
    return (
      <Fragment>{t('Send a notification to #%s', team?.name ?? t('unknown'))}</Fragment>
    );
  }

  if (action.id === IssueAlertActionType.SLACK) {
    const name = action.name
      // Hide the id "(optionally, an ID: XXX)"
      .replace(/\(optionally.*\)/, '')
      // Hide empty tags
      .replace('and show tags [] in notification', '');
    return <Fragment>{name}</Fragment>;
  }

  return <Fragment>{action.name}</Fragment>;
}
