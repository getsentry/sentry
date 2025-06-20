import invariant from 'invariant';
import isPlainObject from 'lodash/isPlainObject';
import {duration} from 'moment-timezone';

import {deviceNameMapper} from 'sentry/components/deviceName';
import isValidDate from 'sentry/utils/date/isValidDate';
import getMinMax from 'sentry/utils/getMinMax';
import type {HydratedReplayRecord, ReplayRecord} from 'sentry/views/replays/types';

const defaultValues = {
  has_viewed: false,
};

function mapUser(user: any): ReplayRecord['tags'] {
  return Object.fromEntries(
    Object.entries(user)
      .filter(([key, value]) => key !== 'display_name' && value)
      .flatMap(([key, value]) => {
        if (isPlainObject(value)) {
          return Object.entries(value as Record<PropertyKey, unknown>).map(
            ([subKey, subValue]) => [`user.${key}.${subKey}`, [String(subValue)]]
          );
        }
        return [[`user.${key}`, [String(value)]]];
      })
  );
}

export function mapResponseToReplayRecord(apiResponse: any): ReplayRecord {
  // Marshal special fields into tags
  const unorderedTags: ReplayRecord['tags'] = {
    ...apiResponse.tags,
    ...(apiResponse.browser?.name ? {'browser.name': [apiResponse.browser.name]} : {}),
    ...(apiResponse.browser?.version
      ? {'browser.version': [apiResponse.browser.version]}
      : {}),
    ...(apiResponse.device?.brand ? {'device.brand': [apiResponse.device.brand]} : {}),
    ...(apiResponse.device?.family ? {'device.family': [apiResponse.device.family]} : {}),
    ...(apiResponse.device?.model
      ? {'device.model': [deviceNameMapper(apiResponse.device.model)]}
      : {}),
    ...(apiResponse.device?.model_id
      ? {'device.model_id': [apiResponse.device.model_id]}
      : {}),
    ...(apiResponse.device?.name ? {'device.name': [apiResponse.device.name]} : {}),
    ...(apiResponse.environment ? {environment: [apiResponse.environment]} : {}),
    ...(apiResponse.platform ? {platform: [apiResponse.platform]} : {}),
    ...(apiResponse.releases ? {releases: [...apiResponse.releases]} : {}),
    ...(apiResponse.replay_type ? {replayType: [apiResponse.replay_type]} : {}),
    ...(apiResponse.os?.name ? {'os.name': [apiResponse.os.name]} : {}),
    ...(apiResponse.os?.version ? {'os.version': [apiResponse.os.version]} : {}),
    ...(apiResponse.sdk?.name ? {'sdk.name': [apiResponse.sdk.name]} : {}),
    ...(apiResponse.sdk?.version ? {'sdk.version': [apiResponse.sdk.version]} : {}),
    ...mapUser(apiResponse.user ?? {}),
  };

  // Stringify everything, so we don't try to render objects or something strange
  // an error boundary will save us, but that's not useful to see
  const stringifiedTags = Object.fromEntries(
    Object.entries(unorderedTags).map(([key, value]) => [
      key,
      value.map((v: unknown) => {
        try {
          return v instanceof Object ? JSON.stringify(v) : v;
        } catch (e) {
          return v;
        }
      }),
    ])
  );

  const startedAt = new Date(apiResponse.started_at);
  invariant(isValidDate(startedAt), 'replay.started_at is invalid');
  const finishedAt = new Date(apiResponse.finished_at);
  invariant(isValidDate(finishedAt), 'replay.finished_at is invalid');
  return {
    ...defaultValues,
    ...apiResponse,
    ...(apiResponse.started_at ? {started_at: startedAt} : {}),
    ...(apiResponse.finished_at ? {finished_at: finishedAt} : {}),
    ...(apiResponse.duration === undefined
      ? {}
      : {duration: duration(apiResponse.duration * 1000)}),
    tags: stringifiedTags,
  };
}

/**
 * We need to figure out the real start and end timestamps based on when
 * first and last bits of data were collected. In milliseconds.
 *
 * @deprecated Once the backend returns the corrected timestamps, this is not needed.
 */
export function replayTimestamps(
  replayRecord: HydratedReplayRecord,
  rrwebEvents: Array<{timestamp: number}>,
  rawCrumbs: Array<{timestamp: number}>,
  rawSpanData: Array<{endTimestamp: number; op: string; startTimestamp: number}>
) {
  const rrwebTimestamps = rrwebEvents.map(event => event.timestamp).filter(Boolean);
  const breadcrumbTimestamps = rawCrumbs
    .map(rawCrumb => rawCrumb.timestamp)
    .filter(Boolean);
  const rawSpanDataFiltered = rawSpanData.filter(
    ({op}) => op !== 'web-vital' && op !== 'largest-contentful-paint'
  );
  const spanStartTimestamps = rawSpanDataFiltered
    .map(span => span.startTimestamp)
    .filter(Boolean);
  const spanEndTimestamps = rawSpanDataFiltered
    .map(span => span.endTimestamp)
    .filter(Boolean);

  // Calculate min/max of each array individually, to prevent extra allocations.
  // Also using `getMinMax()` so we can handle any huge arrays.
  const {min: minRRWeb, max: maxRRWeb} = getMinMax(rrwebTimestamps);
  const {min: minCrumbs, max: maxCrumbs} = getMinMax(breadcrumbTimestamps);
  const {min: minSpanStarts} = getMinMax(spanStartTimestamps);
  const {max: maxSpanEnds} = getMinMax(spanEndTimestamps);

  return {
    startTimestampMs: Math.min(
      replayRecord.started_at.getTime(),
      minRRWeb,
      minCrumbs * 1000,
      minSpanStarts * 1000
    ),
    endTimestampMs: Math.max(
      replayRecord.finished_at.getTime(),
      maxRRWeb,
      maxCrumbs * 1000,
      maxSpanEnds * 1000
    ),
  };
}
