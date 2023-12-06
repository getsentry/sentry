import * as Sentry from '@sentry/react';
import {Transaction} from '@sentry/types';

import {Image} from 'sentry/types/debugImage';

import {Frame} from '../frame';
import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
  isSentrySampledProfile,
} from '../guards/profile';

import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import {Profile} from './profile';
import {SampledProfile} from './sampledProfile';
import {SentrySampledProfile} from './sentrySampledProfile';
import {
  createFrameIndex,
  createSentrySampleProfileFrameIndex,
  wrapWithSpan,
} from './utils';

export interface ImportOptions {
  transaction: Transaction | undefined;
  type: 'flamegraph' | 'flamechart';
  frameFilter?: (frame: Frame) => boolean;
  profileIds?: Readonly<string[]>;
}

export interface ProfileGroup {
  activeProfileIndex: number;
  measurements: Partial<Profiling.Schema['measurements']>;
  metadata: Partial<Profiling.Schema['metadata']>;
  name: string;
  profiles: Profile[];
  traceID: string;
  transactionID: string | null;
  images?: Image[];
}

export function importProfile(
  input: Readonly<Profiling.ProfileInput>,
  traceID: string,
  type: 'flamegraph' | 'flamechart',
  frameFilter?: (frame: Frame) => boolean
): ProfileGroup {
  const transaction = Sentry.startTransaction({
    op: 'import',
    name: 'profiles.import',
  });

  try {
    if (isJSProfile(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'js-self-profile');
      }
      return importJSSelfProfile(input, traceID, {transaction, type});
    }

    if (isSentrySampledProfile(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'sentry-sampled');
      }
      return importSentrySampledProfile(input, {transaction, type, frameFilter});
    }

    if (isSchema(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'schema');
      }
      return importSchema(input, traceID, {transaction, type, frameFilter});
    }

    throw new Error('Unsupported trace format');
  } catch (error) {
    if (transaction) {
      transaction.setStatus('internal_error');
    }
    throw error;
  } finally {
    if (transaction) {
      transaction.finish();
    }
  }
}

function importJSSelfProfile(
  input: Readonly<JSSelfProfiling.Trace>,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex('javascript', input.frames);
  const profile = importSingleProfile(input, frameIndex, options);

  return {
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
    const sample = input.profile.samples[i];
    if (!samplesByThread[sample.thread_id]) {
      samplesByThread[sample.thread_id] = [];
    }
    samplesByThread[sample.thread_id].push(sample);
  }

  for (const key in samplesByThread) {
    samplesByThread[key].sort(
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
        samples: samplesByThread[key],
      },
    };

    if (key === String(input.transaction.active_thread_id)) {
      activeProfileIndex = profiles.length;
    }

    profiles.push(
      wrapWithSpan(
        options.transaction,
        () =>
          SentrySampledProfile.FromProfile(profile, frameIndex, {
            type: options.type,
            frameFilter: options.frameFilter,
          }),
        {
          op: 'profile.import',
          description: 'evented',
        }
      )
    );
  }

  return {
    transactionID: input.transaction.id,
    traceID: input.transaction.trace_id,
    name: input.transaction.name,
    activeProfileIndex,
    measurements: input.measurements,
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
    traceID,
    transactionID: input.metadata.transactionID ?? null,
    name: input.metadata?.transactionName ?? traceID,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    metadata: input.metadata ?? {},
    measurements: input.measurements ?? {},
    profiles: input.profiles.map(profile =>
      importSingleProfile(profile, frameIndex, {
        ...options,
        profileIds: input.shared.profile_ids,
      })
    ),
  };
}

function importSingleProfile(
  profile: Profiling.EventedProfile | Profiling.SampledProfile | JSSelfProfiling.Trace,
  frameIndex: ReturnType<typeof createFrameIndex>,
  {transaction, type, frameFilter, profileIds}: ImportOptions
): Profile {
  if (isEventedProfile(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return EventedProfile.FromProfile(profile, frameIndex, {type, frameFilter});
    }

    return wrapWithSpan(
      transaction,
      () => EventedProfile.FromProfile(profile, frameIndex, {type, frameFilter}),
      {
        op: 'profile.import',
        description: 'evented',
      }
    );
  }
  if (isSampledProfile(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return SampledProfile.FromProfile(profile, frameIndex, {
        type,
        frameFilter,
        profileIds,
      });
    }

    return wrapWithSpan(
      transaction,
      () =>
        SampledProfile.FromProfile(profile, frameIndex, {type, frameFilter, profileIds}),
      {
        op: 'profile.import',
        description: 'sampled',
      }
    );
  }
  if (isJSProfile(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return JSSelfProfile.FromProfile(
        profile,
        createFrameIndex('javascript', profile.frames),
        {
          type,
        }
      );
    }

    return wrapWithSpan(
      transaction,
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
