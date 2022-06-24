import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';

import {
  ActionType,
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Dataset,
  EventTypes,
  TargetType,
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
  query?: string;
  timeWindow?: number;
};
export type Preset = {
  description: string;
  id: string;
  makeContext(
    client: Client,
    project: Project,
    organization: Organization
  ): Promise<PresetContext>;

  title: string;
};

async function getHighestVolumeTransaction(
  client: Client,
  organizationSlug: string,
  projectId: string
): Promise<[string, number] | null> {
  const result = await client.requestPromise(
    `/organizations/${organizationSlug}/events/`,
    {
      method: 'GET',
      data: {
        statsPeriod: '30d',
        project: projectId,
        field: ['count()', 'transaction'],
        sort: '-count',
        referrer: 'alert.presets.highest-volume',
        query: 'event.type:transaction',
        per_page: 1,
      },
    }
  );
  const transaction = result.data[0];
  if (transaction) {
    return [transaction.transaction, transaction['count()']];
  }
  return null;
}

export const PRESET_AGGREGATES: Preset[] = [
  {
    id: 'p95-highest-volume',
    title: t('p95 on Highest Volume Transaction'),
    description: 'Make some noise when your most voluminous transaction gets slow',
    async makeContext(client, project, organization) {
      const transaction = (
        await getHighestVolumeTransaction(client, organization.slug, project.id)
      )?.[0];
      return {
        name: t('p95 Alert for %s', [project.slug]),
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
            actions: project.teams.slice(0, 4).map(team => ({
              type: ActionType.EMAIL,
              targetType: TargetType.TEAM,
              targetIdentifier: team.id,
              unsavedDateCreated: new Date().toISOString(),
              inputChannelId: null,
              options: null,
              unsavedId: uniqueId(),
            })),
          },
          {
            label: AlertRuleTriggerType.WARNING,
            alertThreshold: 100,
            actions: [],
          },
        ],
        query: 'transaction:' + transaction,
      };
    },
  },
  {
    id: 'throughput-highest-volume',
    title: t('Throughput on Highest Volume Transaction'),
    description:
      'Make some noise when your most voluminous transaction handles less transaction',
    async makeContext(client, project, organization) {
      const transaction = (
        await getHighestVolumeTransaction(client, organization.slug, project.id)
      )?.[0];
      return {
        name: t('Throughput Alert for %s', [project.slug]),
        aggregate: 'count()',
        dataset: Dataset.TRANSACTIONS,
        eventTypes: [EventTypes.TRANSACTION],
        timeWindow: 30,
        comparisonDelta: 24 * 60 * 7,
        comparisonType: AlertRuleComparisonType.CHANGE,
        thresholdType: AlertRuleThresholdType.BELOW,
        triggers: [
          {
            label: AlertRuleTriggerType.CRITICAL,
            alertThreshold: 500,
            actions: project.teams.slice(0, 4).map(team => ({
              type: ActionType.EMAIL,
              targetType: TargetType.TEAM,
              targetIdentifier: team.id,
              unsavedDateCreated: new Date().toISOString(),
              inputChannelId: null,
              options: null,
              unsavedId: uniqueId(),
            })),
          },
          {
            label: AlertRuleTriggerType.WARNING,
            alertThreshold: 300,
            actions: [],
          },
        ],
        query: 'transaction:' + transaction,
      };
    },
  },
  {
    id: 'apdex-highest-volume',
    title: t('Apdex regression on Highest Volume Transaction'),
    description: 'Make some noise when your most voluminous transaction regress on apdex',
    async makeContext(client, project, organization) {
      const transaction = (
        await getHighestVolumeTransaction(client, organization.slug, project.id)
      )?.[0];
      return {
        name: t('Apdex regression for %s', [project.slug]),
        aggregate: 'apdex(300)',
        dataset: Dataset.TRANSACTIONS,
        eventTypes: [EventTypes.TRANSACTION],
        timeWindow: 30,
        comparisonDelta: 24 * 60 * 7,
        comparisonType: AlertRuleComparisonType.CHANGE,
        thresholdType: AlertRuleThresholdType.BELOW,
        triggers: [
          {
            label: AlertRuleTriggerType.CRITICAL,
            alertThreshold: 200,
            actions: project.teams.slice(0, 4).map(team => ({
              type: ActionType.EMAIL,
              targetType: TargetType.TEAM,
              targetIdentifier: team.id,
              unsavedDateCreated: new Date().toISOString(),
              inputChannelId: null,
              options: null,
              unsavedId: uniqueId(),
            })),
          },
          {
            label: AlertRuleTriggerType.WARNING,
            alertThreshold: 100,
            actions: [],
          },
        ],
        query: 'transaction:' + transaction,
      };
    },
  },
];
