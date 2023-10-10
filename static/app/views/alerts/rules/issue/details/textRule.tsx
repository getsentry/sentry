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
import {CHANGE_ALERT_CONDITION_IDS} from 'sentry/views/alerts/utils/constants';

/**
 * Translate Issue Alert Conditions to text
 */
export function TextCondition({
  condition,
}: {
  condition: IssueAlertRule['conditions'][number];
}) {
  const organization = useOrganization();

  if (CHANGE_ALERT_CONDITION_IDS.includes(condition.id)) {
    if (condition.comparisonType === AlertRuleComparisonType.PERCENT) {
      if (condition.id === IssueAlertConditionType.EVENT_FREQUENCY_PERCENT) {
        return (
          <Fragment>
            {t(
              // Double %% escapes
              'Percent of sessions affected by an issue is %s%% higher in %s compared to %s ago',
              condition.value,
              condition.interval,
              condition.comparisonInterval
            )}
          </Fragment>
        );
      }
      return (
        <Fragment>
          {t(
            // Double %% escapes
            'Number of events in an issue is %s%% higher in %s compared to %s ago',
            condition.value,
            condition.interval,
            condition.comparisonInterval
          )}
        </Fragment>
      );
    }

    return (
      <Fragment>
        {t(
          'Number of events in an issue is more than %s in %s',
          condition.value,
          condition.interval
        )}
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
