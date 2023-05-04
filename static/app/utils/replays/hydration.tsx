import {duration} from 'moment';

import {t} from 'sentry/locale';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {
  MemorySpanType,
  NetworkSpan,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  // ReplaySpan,
  ReplayRecordingEvent,
} from 'sentry/views/replays/types';

export function hydrateReplayRecord(apiResponse: any): ReplayRecord {
  // Marshal special fields into tags
  const user = Object.fromEntries(
    Object.entries(apiResponse.user)
      .filter(([key, value]) => key !== 'display_name' && value)
      .map(([key, value]) => [`user.${key}`, [value]])
  );
  const unorderedTags: ReplayRecord['tags'] = {
    ...apiResponse.tags,
    ...(apiResponse.browser?.name ? {'browser.name': [apiResponse.browser.name]} : {}),
    ...(apiResponse.browser?.version
      ? {'browser.version': [apiResponse.browser.version]}
      : {}),
    ...(apiResponse.device?.brand ? {'device.brand': [apiResponse.device.brand]} : {}),
    ...(apiResponse.device?.family ? {'device.family': [apiResponse.device.family]} : {}),
    ...(apiResponse.device?.model_id
      ? {'device.model_id': [apiResponse.device.model_id]}
      : {}),
    ...(apiResponse.device?.name ? {'device.name': [apiResponse.device.name]} : {}),
    ...(apiResponse.platform ? {platform: [apiResponse.platform]} : {}),
    ...(apiResponse.releases ? {releases: [...apiResponse.releases]} : {}),
    ...(apiResponse.replay_type ? {replayType: [apiResponse.replay_type]} : {}),
    ...(apiResponse.os?.name ? {'os.name': [apiResponse.os.name]} : {}),
    ...(apiResponse.os?.version ? {'os.version': [apiResponse.os.version]} : {}),
    ...(apiResponse.sdk?.name ? {'sdk.name': [apiResponse.sdk.name]} : {}),
    ...(apiResponse.sdk?.version ? {'sdk.version': [apiResponse.sdk.version]} : {}),
    ...user,
  };

  // Sort the tags by key
  const tags = Object.keys(unorderedTags)
    .sort()
    .reduce((acc, key) => {
      acc[key] = unorderedTags[key];
      return acc;
    }, {});

  return {
    ...apiResponse,
    ...(apiResponse.started_at ? {started_at: new Date(apiResponse.started_at)} : {}),
    ...(apiResponse.finished_at ? {finished_at: new Date(apiResponse.finished_at)} : {}),
    ...(apiResponse.duration !== undefined
      ? {duration: duration(apiResponse.duration * 1000)}
      : {}),
    tags,
  };
}

// export function hydrateRRWebEvent(
//   rrwebEvents: ,
//   replayRecord: ReplayRecord,
// ): ReplayRRWebEvent {
//   const events = ([] as RecordingEvent[]).concat(rrwebEvents).concat({
//     type: 5, // EventType.Custom,
//     timestamp: replayRecord.finished_at.getTime(),
//     data: {
//       tag: 'replay-end',
//     },
//   });

//   events.sort((a, b) => a.timestamp - b.timestamp);

//   const firstRRWebEvent = first(events);
//   firstRRWebEvent!.timestamp = replayRecord.started_at.getTime();

//   return events;
// }

// export function hydrateReplayError(apiResponse: any): ReplayError {
//   return {
//     ['error.type']: apiResponse['error.type'],
//     ['error.value']: apiResponse['error.value'],
//     id: apiResponse.id,
//     issue: apiResponse.issue,
//     ['issue.id']: apiResponse['issue.id'],
//     ['project.name']: apiResponse['project.name'],
//     timestamp: apiResponse.timestamp,
//     title: apiResponse.title,
//   };
// }

function spanId(apiResponse) {
  return `${apiResponse.description ?? apiResponse.op}-${apiResponse.startTimestamp}-${
    apiResponse.endTimestamp
  }`;
}

export function hydrateReplayNetworkSpan(apiResponse: any): NetworkSpan {
  return {
    data: apiResponse.data,
    description: apiResponse.duration,
    endTimestamp: apiResponse.endTimestamp,
    id: spanId(apiResponse),
    op: apiResponse.op,
    startTimestamp: apiResponse.startTimestamp,
    timestamp: apiResponse.startTimestamp * 1000,
    // TODO: offset from replay start
  };
}

export function hydrateReplayMemorySpan(apiResponse: any): MemorySpanType {
  const memory = apiResponse.data?.memory;
  return {
    data: {
      memory: {
        jsHeapSizeLimit: memory?.jsHeapSizeLimit,
        totalJSHeapSize: memory?.totalJSHeapSize,
        usedJSHeapSize: memory?.useJSHeapSize,
      },
    },
    description: apiResponse.duration,
    endTimestamp: apiResponse.endTimestamp,
    id: spanId(apiResponse),
    op: apiResponse.op,
    startTimestamp: apiResponse.startTimestamp,
    timestamp: apiResponse.startTimestamp * 1000,
    // TODO: offset from replay start
  };
}

export function hydrateDefaultCrumb(apiResponse: any): ReplayCrumb {
  if (apiResponse.category === 'replay.mutations') {
    return {
      ...apiResponse,
      type: BreadcrumbType.WARNING,
      level: BreadcrumbLevelType.WARNING,
      timestamp: new Date(apiResponse.timestamp * 1000).toISOString(),
    };
  }

  return {
    ...apiResponse,
    type: BreadcrumbType.DEFAULT,
    timestamp: new Date(apiResponse.timestamp * 1000).toISOString(),
  };
}

export function errorToCrumb(error: ReplayError): ReplayCrumb {
  return {
    type: BreadcrumbType.ERROR,
    level: BreadcrumbLevelType.ERROR,
    category: 'issue',
    message: error.title,
    data: {
      label: error['error.type'].join(''),
      eventId: error.id,
      groupId: error['issue.id'] || 1,
      groupShortId: error.issue,
      project: error['project.name'],
    },
    timestamp: new Date(error.timestamp).getTime(),
  };
}

export function networkSpanToCrumb(span: NetworkSpan): ReplayCrumb {
  if (span.op.startsWith('navigation')) {
    const [, action] = span.op.split('.');
    return {
      category: 'default',
      type: BreadcrumbType.NAVIGATION,
      timestamp: new Date(span.startTimestamp * 1000).toISOString(),
      level: BreadcrumbLevelType.INFO,
      message: span.description,
      action,
      data: {
        to: span.description,
        label:
          action === 'reload'
            ? t('Reload')
            : action === 'navigate'
            ? t('Page load')
            : t('Navigation'),
        ...span.data,
      },
    };
  }

  return {
    type: BreadcrumbType.DEBUG,
    timestamp: new Date(span.startTimestamp * 1000).toISOString(),
    level: BreadcrumbLevelType.INFO,
    category: 'default',
    data: {
      action: span.op,
      ...span.data,
      label: span.op === 'largest-contentful-paint' ? t('LCP') : span.op,
    },
  };
}
