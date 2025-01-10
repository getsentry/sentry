import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';

import type {Image} from 'sentry/types/debugImage';
import {defined} from 'sentry/utils';

import type {Frame} from '../frame';
import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
  isSentryContinuousProfile,
  isSentryContinuousProfileChunk,
  isSentrySampledProfile,
} from '../guards/profile';

import {ContinuousProfile} from './continuousProfile';
import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import type {Profile} from './profile';
import {SampledProfile} from './sampledProfile';
import {SentrySampledProfile} from './sentrySampledProfile';
import {
  createContinuousProfileFrameIndex,
  createFrameIndex,
  createSentrySampleProfileFrameIndex,
  wrapWithSpan,
} from './utils';

export interface ImportOptions {
  span: Span | undefined;
  type: 'flamegraph' | 'flamechart';
  activeThreadId?: string | null;
  continuous?: boolean;
  frameFilter?: (frame: Frame) => boolean;
  profileIds?:
    | Profiling.Schema['shared']['profiles']
    | Profiling.Schema['shared']['profile_ids'];
}

export interface ProfileGroup {
  activeProfileIndex: number;
  measurements: Partial<Profiling.Measurements>;
  metadata: Partial<Profiling.Schema['metadata']>;
  name: string;
  profiles: Profile[];
  traceID: string;
  transactionID: string | null;
  type: 'continuous' | 'transaction' | 'loading';
  images?: Image[];
}

export function importProfile(
  input: Readonly<Profiling.ProfileInput>,
  traceID: string,
  activeThreadId: string | null,
  type: 'flamegraph' | 'flamechart',
  frameFilter?: (frame: Frame) => boolean
): ProfileGroup {
  return Sentry.withScope(scope => {
    const span = Sentry.startInactiveSpan({
      op: 'import',
      name: 'profiles.import',
    });

    try {
      if (isSentryContinuousProfileChunk(input)) {
        scope.setTag('profile.type', 'sentry-continuous');
        return importSentryContinuousProfileChunk(input, traceID, {
          span,
          type,
          frameFilter,
          activeThreadId,
          continuous: true,
        });
      }
      if (isJSProfile(input)) {
        scope.setTag('profile.type', 'js-self-profile');
        return importJSSelfProfile(input, traceID, {span, type});
      }

      if (isSentrySampledProfile(input)) {
        scope.setTag('profile.type', 'sentry-sampled');
        return importSentrySampledProfile(input, {span, type, frameFilter});
      }

      if (isSchema(input)) {
        scope.setTag('profile.type', 'schema');
        return importSchema(input, traceID, {span, type, frameFilter});
      }

      throw new Error('Unsupported trace format');
    } catch (error) {
      span?.setStatus({code: 2, message: 'internal_error'});
      throw error;
    } finally {
      span?.end();
    }
  });
}

function importJSSelfProfile(
  input: Readonly<JSSelfProfiling.Trace>,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex('javascript', input.frames);
  const profile = importSingleProfile(input, frameIndex, options);

  return {
    type: 'transaction',
    traceID,
    name: traceID,
    transactionID: null,
    activeProfileIndex: 0,
    profiles: [profile],
    measurements: {},
    metadata: {
      platform: 'javascript',
    },
  };
}

function importSentrySampledProfile(
  input: Readonly<Profiling.SentrySampledProfile>,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createSentrySampleProfileFrameIndex(
    input.profile.frames,
    input.platform
  );
  const samplesByThread: Record<
    string,
    Profiling.SentrySampledProfile['profile']['samples']
  > = {};

  for (let i = 0; i < input.profile.samples.length; i++) {
    const sample = input.profile.samples[i]!;
    if (!samplesByThread[sample.thread_id]) {
      samplesByThread[sample.thread_id] = [];
    }
    samplesByThread[sample.thread_id]!.push(sample);
  }

  for (const key in samplesByThread) {
    samplesByThread[key]!.sort(
      (a, b) => a.elapsed_since_start_ns - b.elapsed_since_start_ns
    );
  }

  let activeProfileIndex = 0;
  const profiles: Profile[] = [];

  for (const key in samplesByThread) {
    const profile: Profiling.SentrySampledProfile = {
      ...input,
      profile: {
        ...input.profile,
        samples: samplesByThread[key]!,
      },
    };

    if (key === String(input.transaction.active_thread_id)) {
      activeProfileIndex = profiles.length;
    }

    profiles.push(
      wrapWithSpan(
        options.span,
        () =>
          SentrySampledProfile.FromProfile(profile, frameIndex, {
            type: options.type,
            frameFilter: options.frameFilter,
          }),
        {
          op: 'profile.import',
          description: 'sampled',
        }
      )
    );
  }

  return {
    type: 'transaction',
    transactionID: input.transaction.id,
    traceID: input.transaction.trace_id,
    name: input.transaction.name,
    activeProfileIndex,
    measurements: input.measurements ?? {},
    metadata: {
      deviceLocale: input.device.locale,
      deviceManufacturer: input.device.manufacturer,
      deviceModel: input.device.model,
      deviceOSName: input.os.name,
      deviceOSVersion: input.os.version,
      environment: input.environment,
      platform: input.platform,
      profileID: input.event_id,
      projectID: input.project_id,
      release: input.release,
      received: input.received,

      // these don't really work for multiple transactions
      transactionID: input.transaction.id,
      transactionName: input.transaction.name,
      traceID: input.transaction.trace_id,
    },
    profiles,
    images: input.debug_meta?.images,
  };
}

export function importSchema(
  input: Readonly<Profiling.Schema>,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex(
    input.metadata.platform === 'node'
      ? 'node'
      : input.metadata.platform === 'javascript'
        ? 'javascript'
        : 'mobile',
    input.shared.frames
  );

  return {
    type: 'transaction',
    traceID,
    transactionID: input.metadata.transactionID ?? null,
    name: input.metadata?.transactionName ?? traceID,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    metadata: input.metadata ?? {},
    measurements: input.measurements ?? {},
    profiles: input.profiles.map(profile =>
      importSingleProfile(profile, frameIndex, {
        ...options,
        profileIds: input.shared.profile_ids ?? input.shared.profiles,
      })
    ),
  };
}

export function importSentryContinuousProfileChunk(
  input: Readonly<Profiling.SentryContinousProfileChunk>,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createContinuousProfileFrameIndex(
    input.profile.frames,
    input.platform
  );

  const samplesByThread: Record<
    string,
    Profiling.SentryContinousProfileChunk['profile']['samples']
  > = {};

  let firstTimestamp: number | null = null;

  for (let i = 0; i < input.profile.samples.length; i++) {
    const sample = input.profile.samples[i]!;

    if (!defined(firstTimestamp) || firstTimestamp > sample.timestamp) {
      firstTimestamp = sample.timestamp;
    }

    if (!samplesByThread[sample.thread_id]) {
      samplesByThread[sample.thread_id] = [];
    }
    samplesByThread[sample.thread_id]!.push(sample);
  }

  for (const key in samplesByThread) {
    samplesByThread[key]!.sort((a, b) => a.timestamp - b.timestamp);
  }

  const profiles: ContinuousProfile[] = [];
  let activeProfileIndex = 0;

  for (const key in samplesByThread) {
    const profile: Profiling.ContinuousProfile = {
      ...input,
      ...input.profile,
      samples: samplesByThread[key]!,
    };

    if (options.activeThreadId && key === options.activeThreadId) {
      activeProfileIndex = profiles.length;
    }

    profiles.push(
      wrapWithSpan(
        options.span,
        () => ContinuousProfile.FromProfile(profile, frameIndex),
        {
          op: 'profile.import',
          description: 'continuous',
        }
      )
    );
  }

  return {
    traceID,
    name: '',
    type: 'continuous',
    transactionID: null,
    activeProfileIndex,
    profiles,
    measurements: measurementsFromContinuousMeasurements(
      input.measurements ?? {},
      firstTimestamp
    ),
    metadata: {
      platform: input.platform,
      projectID: input.project_id,
    },
  };
}

function measurementsFromContinuousMeasurements(
  continuousMeasurements: Profiling.ContinuousMeasurements,
  firstTimestamp: number | null
): Profiling.Measurements {
  for (const continuousMeasurement of Object.values(continuousMeasurements)) {
    for (const value of continuousMeasurement.values) {
      if (!defined(firstTimestamp) || firstTimestamp > value.timestamp) {
        firstTimestamp = value.timestamp;
      }
    }
  }

  // couldn't find any timestamps so there must not be any measurements
  if (!defined(firstTimestamp)) {
    return {};
  }

  const measurements = {};

  for (const [key, continuousMeasurement] of Object.entries(continuousMeasurements)) {
    measurements[key] = measurementFromContinousMeasurement(
      continuousMeasurement,
      firstTimestamp
    );
  }

  return measurements;
}

function measurementFromContinousMeasurement(
  continuousMeasurement: Profiling.ContinuousMeasurement,
  anchor: number
): Profiling.Measurement {
  return {
    unit: continuousMeasurement.unit,
    values: continuousMeasurement.values.map(continuousMeasurementValue => {
      const elapsed_since_start_s = continuousMeasurementValue.timestamp - anchor;
      return {
        elapsed_since_start_ns: elapsed_since_start_s * 1e9,
        value: continuousMeasurementValue.value,
      };
    }),
  };
}

function importSingleProfile(
  profile:
    | Profiling.ContinuousProfile
    | Profiling.EventedProfile
    | Profiling.SampledProfile
    | JSSelfProfiling.Trace,
  frameIndex:
    | ReturnType<typeof createFrameIndex>
    | ReturnType<typeof createContinuousProfileFrameIndex>
    | ReturnType<typeof createSentrySampleProfileFrameIndex>,
  {span, type, frameFilter, profileIds}: ImportOptions
): Profile {
  if (isSentryContinuousProfile(profile)) {
    // In some cases, the SDK may return spans as undefined and we dont want to throw there.
    if (!span) {
      return ContinuousProfile.FromProfile(profile, frameIndex);
    }

    return wrapWithSpan(span, () => ContinuousProfile.FromProfile(profile, frameIndex), {
      op: 'profile.import',
      description: 'continuous-profile',
    });
  }
  if (isEventedProfile(profile)) {
    // In some cases, the SDK may return spans as undefined and we dont want to throw there.
    if (!span) {
      return EventedProfile.FromProfile(profile, frameIndex, {type, frameFilter});
    }

    return wrapWithSpan(
      span,
      () => EventedProfile.FromProfile(profile, frameIndex, {type, frameFilter}),
      {
        op: 'profile.import',
        description: 'evented',
      }
    );
  }
  if (isSampledProfile(profile)) {
    // In some cases, the SDK may return spans as undefined and we dont want to throw there.
    if (!span) {
      return SampledProfile.FromProfile(profile, frameIndex, {
        type,
        frameFilter,
        profileIds,
      });
    }

    return wrapWithSpan(
      span,
      () =>
        SampledProfile.FromProfile(profile, frameIndex, {type, frameFilter, profileIds}),
      {
        op: 'profile.import',
        description: 'sampled',
      }
    );
  }
  if (isJSProfile(profile)) {
    // In some cases, the SDK may return spans as undefined and we dont want to throw there.
    if (!span) {
      return JSSelfProfile.FromProfile(
        profile,
        createFrameIndex('javascript', profile.frames),
        {
          type,
        }
      );
    }

    return wrapWithSpan(
      span,
      () =>
        JSSelfProfile.FromProfile(
          profile,
          createFrameIndex('javascript', profile.frames),
          {
            type,
          }
        ),
      {
        op: 'profile.import',
        description: 'js-self-profile',
      }
    );
  }
  throw new Error('Unrecognized trace format');
}

const tryParseInputString: JSONParser = input => {
  try {
    return [JSON.parse(input), null];
  } catch (e) {
    return [null, e];
  }
};

type JSONParser = (input: string) => [any, null] | [null, Error];

const TRACE_JSON_PARSERS: ((string) => ReturnType<JSONParser>)[] = [
  (input: string) => tryParseInputString(input),
  (input: string) => tryParseInputString(input + ']'),
];

function readFileAsString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', (e: ProgressEvent<FileReader>) => {
      if (typeof e.target?.result === 'string') {
        resolve(e.target.result);
        return;
      }

      reject('Failed to read string contents of input file');
    });

    reader.addEventListener('error', () => {
      reject('Failed to read string contents of input file');
    });

    reader.readAsText(file);
  });
}

export async function parseDroppedProfile(
  file: File,
  parsers: JSONParser[] = TRACE_JSON_PARSERS
): Promise<Profiling.ProfileInput> {
  const fileContents = await readFileAsString(file);

  for (const parser of parsers) {
    const [json] = parser(fileContents);

    if (json) {
      if (typeof json !== 'object' || json === null) {
        throw new TypeError('Input JSON is not an object');
      }

      return json;
    }
  }

  throw new Error('Failed to parse input JSON');
}
