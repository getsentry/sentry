import {MonitorBucket} from 'sentry/views/monitors/components/overviewTimeline/types';

export function filterMonitorStatsBucketByEnv(
  bucket: MonitorBucket,
  environment: string
): MonitorBucket {
  const [timestamp, envMapping] = bucket;
  const envStatusCounts = envMapping[environment]
    ? {[environment]: envMapping[environment]}
    : {};
  return [timestamp, envStatusCounts];
}
