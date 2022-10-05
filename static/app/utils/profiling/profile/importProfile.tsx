import * as Sentry from '@sentry/react';
import {Transaction} from '@sentry/types';

import {
  isChromeTraceFormat,
  isChromeTraceObjectFormat,
  isEventedProfile,
  isJSProfile,
  isNodeProfile,
  isSampledProfile,
  isSchema,
  isSentrySampledProfile,
  isTypescriptChromeTraceArrayFormat,
} from '../guards/profile';

import {parseTypescriptChromeTraceArrayFormat} from './chromeTraceProfile';
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
}

export interface ProfileGroup {
  activeProfileIndex: number;
  metadata: Partial<Profiling.Schema['metadata']>;
  name: string;
  profiles: Profile[];
  traceID: string;
  transactionID: string | null;
}

export function importProfile(
  input:
    | Profiling.Schema
    | JSSelfProfiling.Trace
    | ChromeTrace.ProfileType
    | Profiling.SentrySampledProfile
    | [Profiling.NodeProfile, {}], // this is hack so that we distinguish between typescript and node profiles
  traceID: string
): ProfileGroup {
  const transaction = Sentry.startTransaction({
    op: 'import',
    name: 'profiles.import',
  });

  try {
    if (isNodeProfile(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'nodejs');
      }

      return importNodeProfile(input[0], traceID, {transaction});
    }

    if (isJSProfile(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'js-self-profile');
      }
      return importJSSelfProfile(input, traceID, {transaction});
    }

    if (isChromeTraceFormat(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'chrometrace');
      }
      return importChromeTrace(input, traceID, {transaction});
    }

    if (isSentrySampledProfile(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'sentry-sampled');
      }
      return importSentrySampledProfile(input, {transaction});
    }

    if (isSchema(input)) {
      // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
      if (transaction) {
        transaction.setTag('profile.type', 'schema');
      }
      return importSchema(input, traceID, {transaction});
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
  input: JSSelfProfiling.Trace,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex('web', input.frames);
  const profile = importSingleProfile(input, frameIndex, options);

  return {
    traceID,
    name: traceID,
    transactionID: null,
    activeProfileIndex: 0,
    profiles: [profile],
    metadata: {
      platform: 'javascript',
      durationNS: profile.duration,
    },
  };
}

function importChromeTrace(
  input: ChromeTrace.ProfileType,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  if (isChromeTraceObjectFormat(input)) {
    throw new Error('Chrometrace object format is not yet supported');
  }

  if (isTypescriptChromeTraceArrayFormat(input)) {
    return parseTypescriptChromeTraceArrayFormat(input, traceID, options);
  }

  throw new Error('Failed to parse trace input format');
}

function importSentrySampledProfile(
  input: Profiling.SentrySampledProfile,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createSentrySampleProfileFrameIndex(input.profile.frames);
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
      (a, b) =>
        parseInt(a.elapsed_since_start_ns, 10) - parseInt(b.elapsed_since_start_ns, 10)
    );
  }

  const profiles: Profile[] = [];

  for (const key in samplesByThread) {
    const profile: Profiling.SentrySampledProfile = {
      ...input,
      profile: {
        ...input.profile,
        samples: samplesByThread[key],
      },
    };
    profiles.push(
      wrapWithSpan(
        options.transaction,
        () => SentrySampledProfile.FromProfile(profile, frameIndex),
        {
          op: 'profile.import',
          description: 'evented',
        }
      )
    );
  }

  const firstTransaction = input.transactions?.[0];
  return {
    transactionID: firstTransaction?.id ?? null,
    traceID: firstTransaction?.trace_id ?? '',
    name: firstTransaction?.name ?? '',
    activeProfileIndex: 0,
    metadata: {
      // androidAPILevel: number;
      // deviceClassification: string;
      // organizationID: number;
      // projectID: number;
      // received: string;

      deviceLocale: input.device.locale,
      deviceManufacturer: input.device.manufacturer,
      deviceModel: input.device.model,
      deviceOSName: input.os.name,
      deviceOSVersion: input.os.version,
      durationNS: parseInt(
        input.profile.samples[input.profile.samples.length - 1].elapsed_since_start_ns,
        10
      ),
      environment: input.environment,
      platform: input.platform,
      version: input.version,
      profileID: input.event_id,

      // these don't really work for multiple transactions
      transactionID: firstTransaction?.id,
      transactionName: firstTransaction?.name,
      traceID: firstTransaction?.trace_id,
    },
    profiles,
  };
}

function importSchema(
  input: Profiling.Schema,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex('mobile', input.shared.frames);

  return {
    traceID,
    transactionID: input.metadata.transactionID ?? null,
    name: input.metadata?.transactionName ?? traceID,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    metadata: input.metadata ?? {},
    profiles: input.profiles.map(profile =>
      importSingleProfile(profile, frameIndex, options)
    ),
  };
}

function importNodeProfile(
  input: Profiling.NodeProfile,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex('web', input.frames);

  return {
    traceID,
    transactionID: null,
    name: input.name,
    activeProfileIndex: 0,
    metadata: {},
    profiles: [importSingleProfile(input, frameIndex, options)],
  };
}

function importSingleProfile(
  profile: Profiling.ProfileTypes,
  frameIndex: ReturnType<typeof createFrameIndex>,
  {transaction}: ImportOptions
): Profile {
  if (isEventedProfile(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return EventedProfile.FromProfile(profile, frameIndex);
    }

    return wrapWithSpan(
      transaction,
      () => EventedProfile.FromProfile(profile, frameIndex),
      {
        op: 'profile.import',
        description: 'evented',
      }
    );
  }
  if (isSampledProfile(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return SampledProfile.FromProfile(profile, frameIndex);
    }

    return wrapWithSpan(
      transaction,
      () => SampledProfile.FromProfile(profile, frameIndex),
      {
        op: 'profile.import',
        description: 'sampled',
      }
    );
  }
  if (isJSProfile(profile)) {
    // In some cases, the SDK may return transaction as undefined and we dont want to throw there.
    if (!transaction) {
      return JSSelfProfile.FromProfile(profile, createFrameIndex('web', profile.frames));
    }

    return wrapWithSpan(
      transaction,
      () => JSSelfProfile.FromProfile(profile, createFrameIndex('web', profile.frames)),
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

export async function importDroppedProfile(
  file: File,
  parsers: JSONParser[] = TRACE_JSON_PARSERS
): Promise<ProfileGroup> {
  const fileContents = await readFileAsString(file);

  for (const parser of parsers) {
    const [json] = parser(fileContents);

    if (json) {
      if (typeof json !== 'object' || json === null) {
        throw new TypeError('Input JSON is not an object');
      }

      return importProfile(json, file.name);
    }
  }

  throw new Error('Failed to parse input JSON');
}
