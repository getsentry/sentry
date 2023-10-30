import {
  JobTickData,
  MonitorBucketData,
} from 'sentry/views/monitors/components/overviewTimeline/types';

import {filterMonitorStatsBucketByEnv} from './filterMonitorStatsBucketByEnv';
import {getAggregateStatus} from './getAggregateStatus';
import {getAggregateStatusFromMultipleBuckets} from './getAggregateStatusFromMultipleBuckets';
import {isEnvMappingEmpty} from './isEnvMappingEmpty';
import {mergeEnvMappings} from './mergeEnvMappings';

function generateJobTickFromBucket(
  bucket: MonitorBucketData[number],
  options?: Partial<JobTickData>
) {
  const [timestamp, envMapping] = bucket;
  return {
    endTs: timestamp,
    startTs: timestamp,
    width: 1,
    envMapping,
    roundedLeft: false,
    roundedRight: false,
    ...options,
  };
}

export function mergeBuckets(data: MonitorBucketData, environment: string) {
  const minTickWidth = 4;

  const jobTicks: JobTickData[] = [];
  data.reduce(
    (currentJobTick, bucket, i) => {
      const filteredBucket = filterMonitorStatsBucketByEnv(bucket, environment);

      const [timestamp, envMapping] = filteredBucket;
      const envMappingEmpty = isEnvMappingEmpty(envMapping);
      if (!currentJobTick) {
        return envMappingEmpty
          ? currentJobTick
          : generateJobTickFromBucket(filteredBucket, {roundedLeft: true});
      }
      const bucketStatus = getAggregateStatus(envMapping);
      const currJobTickStatus = getAggregateStatus(currentJobTick.envMapping);
      // If the current bucket is empty and our job tick has reached a min width
      if (envMappingEmpty && currentJobTick.width >= minTickWidth) {
        // Then add our current tick to the running list of job ticks to render
        currentJobTick.roundedRight = true;
        jobTicks.push(currentJobTick);

        return null;
      }

      const nextTickAggregateStatus = getAggregateStatusFromMultipleBuckets(
        data.slice(i, i + minTickWidth).map(([_, envData]) => envData)
      );
      // If the next buckets have a different status from our current job tick
      if (
        bucketStatus !== currJobTickStatus &&
        nextTickAggregateStatus !== currJobTickStatus &&
        currentJobTick.width >= minTickWidth
      ) {
        // Then add our current tick to the running list of job ticks to render
        jobTicks.push(currentJobTick);
        return generateJobTickFromBucket(filteredBucket);
      }

      // Merge our current tick with the current bucket data
      currentJobTick = {
        ...currentJobTick,
        endTs: timestamp,
        envMapping: mergeEnvMappings(currentJobTick.envMapping, envMapping),
        width: currentJobTick.width + 1,
      };

      // Ensure we render the last tick
      if (i === data.length - 1) {
        currentJobTick.roundedRight = true;
        jobTicks.push(currentJobTick);
      }
      return currentJobTick;
    },
    null as JobTickData | null
  );

  return jobTicks;
}
