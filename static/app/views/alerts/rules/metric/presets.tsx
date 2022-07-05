import {Client} from 'sentry/api';
import {IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';

import {AlertType} from '../../wizard/options';

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

export type PresetContext = {
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
  Icon: typeof IconGraph;
  // Will be shown on the corresponding alert type in the wizard.
  alertType: AlertType;
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
        statsPeriod: '7d',
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

function makeTeamCriticalAlert(project: Project, threshold: number = 200) {
  return {
    label: AlertRuleTriggerType.CRITICAL,
    alertThreshold: threshold,
    actions: project.teams.slice(0, 4).map(team => ({
      type: ActionType.EMAIL,
      targetType: TargetType.TEAM,
      targetIdentifier: team.id,
      unsavedDateCreated: new Date().toISOString(),
      inputChannelId: null,
      options: null,
      unsavedId: uniqueId(),
    })),
  };
}
function makeTeamWarningAlert(threshold: number = 100) {
  return {
    label: AlertRuleTriggerType.WARNING,
    alertThreshold: threshold,
    actions: [],
  };
}

export const PRESET_AGGREGATES: Preset[] = [
  {
    id: 'p95-highest-volume',
    title: t('Slow transactions'),
    description: 'Get notified when important transactions are slower on average',
    Icon: IconGraph,
    alertType: 'trans_duration',
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
        triggers: [makeTeamCriticalAlert(project), makeTeamWarningAlert()],
        query: 'transaction:' + transaction,
      };
    },
  },
  {
    id: 'throughput-highest-volume',
    title: t('Throttled throughput'),
    description: 'Send an alert when transaction throughput drops significantly',
    Icon: IconGraph,
    alertType: 'throughput',
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
        triggers: [makeTeamCriticalAlert(project, 500), makeTeamWarningAlert(300)],
        query: 'transaction:' + transaction,
      };
    },
  },
  {
    id: 'apdex-highest-volume',
    title: t('Apdex Score'),
    description:
      'Learn when the ratio of satisfactory, tolerable, and frustrated requests drop',
    Icon: IconGraph,
    alertType: 'apdex',
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
        triggers: [makeTeamCriticalAlert(project), makeTeamWarningAlert()],
        query: 'transaction:' + transaction,
      };
    },
  },
];
