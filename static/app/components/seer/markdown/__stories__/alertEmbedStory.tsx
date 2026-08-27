import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

import {EmbedStory, EmbedVariant} from './embedStory';

const STORY_DETECTOR_ALERTS = [
  {type: 'metric_issue', kind: 'metric', label: 'Metric alert'},
  {type: 'uptime_domain_failure', kind: 'uptime', label: 'Uptime alert'},
  {type: 'monitor_check_in_failure', kind: 'cron', label: 'Cron alert'},
] as const satisfies Array<{
  kind: 'metric' | 'uptime' | 'cron';
  label: string;
  type: Detector['type'];
}>;

export function AlertEmbedStory() {
  const organization = useOrganization();
  const detectorQuery = useQuery(
    detectorListApiOptions(organization, {
      sortBy: '-id',
      limit: 100,
      includeIssueStreamDetectors: true,
    })
  );
  const automationQuery = useQuery(
    automationsApiOptions(organization, {sortBy: '-lastTriggered', limit: 100})
  );
  const issueAlertId = detectorQuery.data?.find(
    detector => detector.type === 'issue_stream'
  )?.workflowIds[0];
  const issueAlert = automationQuery.data?.find(
    automation => automation.id === issueAlertId
  );
  const detectorAlerts = STORY_DETECTOR_ALERTS.flatMap(({kind, label, type}) => {
    const detector = detectorQuery.data?.find(candidate => candidate.type === type);
    return detector ? [{detector, kind, label}] : [];
  });
  const hasAlerts = Boolean(issueAlert || detectorAlerts.length);
  const isPending = detectorQuery.isPending || automationQuery.isPending;
  const isError = detectorQuery.isError || automationQuery.isError;

  return (
    <EmbedStory name="alert">
      {isPending ? (
        <LoadingIndicator />
      ) : hasAlerts ? (
        <Fragment>
          {issueAlert ? (
            <EmbedVariant
              name="alert"
              label="Issue alert"
              data={{id: issueAlert.id, kind: 'issue', name: issueAlert.name}}
              demoProps={{
                minHeight: undefined,
                maxHeight: undefined,
                overflow: undefined,
              }}
            />
          ) : null}
          {detectorAlerts.map(({detector, kind, label}) => (
            <EmbedVariant
              key={kind}
              name="alert"
              label={label}
              data={{id: detector.id, kind, name: detector.name}}
              demoProps={{
                minHeight: undefined,
                maxHeight: undefined,
                overflow: undefined,
              }}
            />
          ))}
        </Fragment>
      ) : isError ? (
        <Text variant="muted">Unable to load an alert example.</Text>
      ) : (
        <Text variant="muted">No alert is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
