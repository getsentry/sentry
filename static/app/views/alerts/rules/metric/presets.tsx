import {Client} from 'sentry/api';
import type {LinkProps} from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {DisplayModes} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Incident, IncidentStats} from 'sentry/views/alerts/types';
import {getStartEndFromStats} from 'sentry/views/alerts/utils';
import {getIncidentDiscoverUrl} from 'sentry/views/alerts/utils/getIncidentDiscoverUrl';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Dataset,
  EventTypes,
  Trigger,
} from './types';

type PresetContext = {
  aggregate: string;
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  eventTypes: EventTypes[];
  name: string;
  thresholdType: AlertRuleThresholdType;

  triggers: Trigger[];
  comparisonDelta?: number;
  timeWindow?: number;
};
export type Preset = {
  description: string;
  id: string;
  makeContext(project: Project, organization: Organization): Promise<PresetContext>;

  title: string;
};

export const PRESET_AGGREGATES: Preset[] = [
  {
    id: 'p95-highest-volume',
    title: 'p95 on Highest Volume Transaction',
    description: 'Make some noise when your most voluminous transaction gets slow',
    async makeContext(project, organization) {
      const client = new Client();
      const result = await client.requestPromise(
        `/organizations/${organization.slug}/eventsv2/`,
        {
          method: 'GET',
          data: {
            statsPeriod: '7d',
            project: project.id,
            field: ['count()', 'transaction'],
            sort: '-count',
            referrer: 'alert.presets.' + this.id,
            per_page: 1,
          },
        }
      );
      return {
        name: t('p95 Alert for s Project', [project.id]),
        aggregate: 'p95(transaction.duration)',
        dataset: Dataset.TRANSACTIONS,
        eventTypes: [EventTypes.TRANSACTION],
        timeWindow: 60,
        comparisonDelta: 1440,
        comparisonType: AlertRuleComparisonType.CHANGE,
        thresholdType: AlertRuleThresholdType.ABOVE,
        triggers: [
          {
            label: AlertRuleTriggerType.CRITICAL,
            alertThreshold: 200,
            actions: [],
          },
          {
            label: AlertRuleTriggerType.WARNING,
            alertThreshold: 100,
            actions: [],
          },
        ],
      };
    },
  },
];
