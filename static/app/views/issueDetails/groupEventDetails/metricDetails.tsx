import {Fragment, useEffect, useState} from 'react';
import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/button';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import RelatedIssues from 'sentry/views/alerts/rules/metric/details/relatedIssues';
import {Dataset, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {fetchAlertRule} from 'sentry/views/alerts/utils/apiCalls';

import {SectionKey} from '../streamline/context';
import {InterimSection} from '../streamline/interimSection';

interface MetricDetailsProps {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
}

export default function MetricDetails({
  organization,
  event,
  group,
  project,
}: MetricDetailsProps) {
  const [rule, setRule] = useState<any>(null);
  const ruleId = event.contexts?.metric_alert?.alert_rule_id;
  useEffect(() => {
    async function getRuleData() {
      if (!ruleId) {
        return;
      }
      const ruleData = await fetchAlertRule(organization.slug, ruleId, {
        expand: 'latestIncident',
      });
      setRule(ruleData);
    }
    getRuleData();
  }, [ruleId, organization.slug]);

  const openPeriod = group.openPeriods?.[0];
  if (!ruleId || !openPeriod) {
    return null;
  }

  const start = openPeriod.start;
  let end = openPeriod.end;
  if (!end) {
    end = moment().toISOString();
  }
  const getTimePeriod = (): TimePeriodType => {
    return {
      start,
      end,
      period: TimePeriod.SEVEN_DAYS,
      usingPeriod: false,
      label: t('Custom time'),
      display: (
        <Fragment>
          <DateTime date={moment.utc(start)} />
          {' — '}
          <DateTime date={moment.utc(end)} />
        </Fragment>
      ),
      custom: true,
    };
  };

  const timePeriod = getTimePeriod();

  if (!rule || !timePeriod) {
    return null;
  }

  const {dataset, query} = rule;

  const queryParams = {
    start,
    end,
    groupStatsPeriod: 'auto',
    limit: 5,
    ...(rule.environment ? {environment: rule.environment} : {}),
    sort: rule.aggregate === 'count_unique(user)' ? 'user' : 'freq',
    query,
    project: [project.id],
  };
  const issueSearch = {
    pathname: `/organizations/${organization.slug}/issues/`,
    query: queryParams,
  };

  const actions = (
    <LinkButton data-test-id="issues-open" size="xs" to={issueSearch}>
      {t('Open in Issues')}
    </LinkButton>
  );

  return (
    <InterimSection
      title={t('Correlated Issues')}
      type={SectionKey.CORRELATED_ISSUES}
      help={t('A list of issues that are correlated with this event')}
      actions={actions}
    >
      {[Dataset.METRICS, Dataset.SESSIONS, Dataset.ERRORS].includes(dataset) && (
        <RelatedIssues
          organization={organization}
          rule={rule}
          projects={[project]}
          timePeriod={timePeriod}
          query={
            dataset === Dataset.ERRORS
              ? // Not using (query) AND (event.type:x) because issues doesn't support it yet
                `${extractEventTypeFilterFromRule(rule)} ${query}`.trim()
              : isCrashFreeAlert(dataset)
                ? `${query} error.unhandled:true`.trim()
                : undefined
          }
          skipHeader
        />
      )}
    </InterimSection>
  );
}
