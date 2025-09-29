import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';

import type {Image} from 'sentry/types/debugImage';
import {defined} from 'sentry/utils';
import type {Frame} from 'sentry/utils/profiling/frame';
import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
  isSentryAndroidContinuousProfileChunk,
  isSentryContinuousProfile,
  isSentryContinuousProfileChunk,
  isSentrySampledProfile,
} from 'sentry/utils/profiling/guards/profile';

import {ContinuousProfile, minTimestampInChunk} from './continuousProfile';
import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import type {Profile} from './profile';
import {SampledProfile} from './sampledProfile';
import {SentrySampledProfile} from './sentrySampledProfile';
import {
  createAndroidContinuousProfileFrameIndex,
  createContinuousProfileFrameIndex,
  createFrameIndex,
  createSentrySampleProfileFrameIndex,
  wrapWithSpan,
} from './utils';

interface ImportOptions {
  span: Span | undefined;
  type: 'flamegraph' | 'flamechart';
  activeThreadId?: string | null;
  continuous?: boolean;
  frameFilter?: (frame: Frame) => boolean;
  profiles?: Profiling.Schema['shared']['profiles'];
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
        if (isSentryAndroidContinuousProfileChunk(input)) {
          return importAndroidContinuousProfileChunk(input, traceID, {
            span,
            type,
            frameFilter,
            activeThreadId,
            continuous: true,
          });
        }
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

  for (const sample of input.profile.samples) {
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

function importSchema(
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
    input.shared.frames.map((frame, i) => {
      const frameInfo = input.shared.frame_infos?.[i];
      return {
        ...frame,
        count: frameInfo?.count,
        weight: frameInfo?.sumDuration,
      };
    })
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
        profiles: input.shared.profiles,
      })
    ),
  };
}

export function eventedProfileToSampledProfile(
  profileTimestamp: number,
  input: ReadonlyArray<Readonly<Profiling.EventedProfile>>
): Pick<
  Readonly<Profiling.SentryContinousProfileChunk>['profile'],
  'samples' | 'stacks' | 'thread_metadata'
> {
  const stacks: Profiling.SentrySampledProfile['profile']['stacks'] = [];
  const samples: Profiling.SentrySampledProfileChunkSample[] = [];
  const thread_metadata: Profiling.SentrySampledProfile['profile']['thread_metadata'] =
    {};

  for (const profile of input) {
    let stackId = 0;
    const stack: number[] = [];

    thread_metadata[profile.threadID] = {
      name: profile.name,
    };

    stack.push(profile.events[0]!.frame);
    samples.push({
      stack_id: stackId,
      thread_id: String(profile.threadID),
      timestamp: profileTimestamp + profile.events[0]!.at * 1e-9,
    });
    stacks[stackId] = stack.slice().reverse();
    stackId++;

    for (let i = 1; i < profile.events.length; i++) {
      const current = profile.events[i]!;
      const previous = profile.events[i - 1] ?? current;

      if (current.type === 'O') {
        stack.push(current.frame);
      } else if (current.type === 'C') {
        const poppedFrame = stack.pop();

        if (poppedFrame === undefined) {
          throw new Error('Stack underflow');
        }
        if (poppedFrame !== current.frame) {
          throw new Error('Stack mismatch');
        }
      } else {
        throw new TypeError('Unknown event type, expected O or C, got ' + current.type);
      }

      if (current.at !== previous.at) {
        samples.push({
          stack_id: stackId,
          thread_id: String(profile.threadID),
          timestamp: profileTimestamp + current.at * 1e-9,
        });

        stacks[stackId] = stack.slice().reverse();
        stackId++;
      }
    }

    if (stack.length > 0) {
      samples.push({
        stack_id: stackId,
        thread_id: String(profile.threadID),
        timestamp:
          profileTimestamp + profile.events[profile.events.length - 1]!.at * 1e-9,
      });
      stacks[stackId] = stack.slice().reverse();
      stackId++;
    }
  }

  return {
    samples,
    stacks,
    thread_metadata,
  };
}

export function importAndroidContinuousProfileChunk(
  input: Profiling.SentryAndroidContinuousProfileChunk,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createAndroidContinuousProfileFrameIndex(
    input.shared.frames,
    input.metadata.platform
  );

  const frames: Profiling.SentrySampledProfileFrame[] = [];
  for (const frame of input.shared.frames) {
    frames.push({
      in_app: frame.is_application ?? false,
      filename: frame.file,
      abs_path: frame.path,
      module: frame.module,
      package: frame.package,
      column: frame.columnNumber ?? frame?.col ?? frame?.column,
      symbol: frame.symbol,
      lineno: frame.lineNumber,
      colno: frame.columnNumber,
      function: frame.name,
    });
  }

  const samplesByThread: Record<
    string,
    Profiling.SentryContinousProfileChunk['profile']['samples']
  > = {};

  if (!input.metadata.timestamp) {
    throw new TypeError(
      'No timestamp found in metadata, typestamp is required to render continuous profiles'
    );
  }
  const profileTimestampInSeconds = new Date(input.metadata.timestamp).getTime() * 1e-3;

  const convertedProfile = eventedProfileToSampledProfile(
    profileTimestampInSeconds,
    input.profiles
  );

  const minTimestamp = minTimestampInChunk(
    {...convertedProfile, frames},
    input.measurements ?? {}
  );

  for (const sample of convertedProfile.samples) {
    if (!samplesByThread[sample.thread_id]) {
      samplesByThread[sample.thread_id] = [];
    }
    samplesByThread[sample.thread_id]!.push(sample);
  }

  const profiles: ContinuousProfile[] = [];
  let activeProfileIndex = input.activeProfileIndex ?? 0;

  if (options.activeThreadId === undefined) {
    options.activeThreadId = String(input.profiles[activeProfileIndex]?.threadID);
  }

  for (const key in samplesByThread) {
    samplesByThread[key]!.sort((a, b) => a.timestamp - b.timestamp);

    const profile: Profiling.ContinuousProfile = {
      ...convertedProfile,
      frames,
      samples: samplesByThread[key]!,
    };

    if (options.activeThreadId && key === options.activeThreadId) {
      activeProfileIndex = profiles.length;
    }

    profiles.push(
      wrapWithSpan(
        options.span,
        () =>
          ContinuousProfile.FromProfile(profile, frameIndex, {
            minTimestamp,
            type: options.type,
            frameFilter: options.frameFilter,
          }),
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
      minTimestamp
    ),
    metadata: {
      platform: input.metadata.platform,
      projectID: input.metadata.projectID,
    },
  };
}

function importSentryContinuousProfileChunk(
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

  const minTimestamp = minTimestampInChunk(input.profile, input.measurements);

  for (const sample of input.profile.samples) {
    if (!samplesByThread[sample.thread_id]) {
      samplesByThread[sample.thread_id] = [];
    }
    samplesByThread[sample.thread_id]!.push(sample);
  }

  const profiles: ContinuousProfile[] = [];
  let activeProfileIndex = 0;

  for (const key in samplesByThread) {
    samplesByThread[key]!.sort((a, b) => a.timestamp - b.timestamp);
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
        () =>
          ContinuousProfile.FromProfile(profile, frameIndex, {
            minTimestamp,
            type: options.type,
            frameFilter: options.frameFilter,
          }),
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
      minTimestamp
    ),
    metadata: {
      platform: input.platform,
      projectID: input.project_id,
    },
  };
}

function measurementsFromContinuousMeasurements(
  continuousMeasurements: Profiling.ContinuousMeasurements,
  minTimestamp: number | null
): Profiling.Measurements {
  // couldn't find any timestamps so there must not be any measurements
  if (!defined(minTimestamp)) {
    return {};
  }

  const measurements: Profiling.Measurements = {};

  for (const [key, continuousMeasurement] of Object.entries(continuousMeasurements)) {
    measurements[key] = measurementFromContinousMeasurement(
      continuousMeasurement,
      minTimestamp
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
  {span, type, frameFilter, profiles}: ImportOptions
): Profile {
  if (isSentryContinuousProfile(profile)) {
    const minTimestamp = minTimestampInChunk(profile);

    // In some cases, the SDK may return spans as undefined and we dont want to throw there.
    if (!span) {
      return ContinuousProfile.FromProfile(profile, frameIndex, {
        minTimestamp,
        type,
        frameFilter,
      });
    }

    return wrapWithSpan(
      span,
      () =>
        ContinuousProfile.FromProfile(profile, frameIndex, {
          minTimestamp,
          type,
          frameFilter,
        }),
      {
        op: 'profile.import',
        description: 'continuous-profile',
      }
    );
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
        profiles,
      });
    }

    return wrapWithSpan(
      span,
      () =>
        SampledProfile.FromProfile(profile, frameIndex, {type, frameFilter, profiles}),
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
