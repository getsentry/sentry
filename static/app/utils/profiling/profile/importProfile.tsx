import * as Sentry from '@sentry/react';
import {Transaction} from '@sentry/types';

import {
  isChromeTraceArrayFormat,
  isChromeTraceFormat,
  isChromeTraceObjectFormat,
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
} from '../guards/profile';

import {ChromeTraceProfile, importChromeTraceProfile} from './formats/chromeTraceProfile';
import {EventedProfile} from './formats/eventedProfile';
import {JSSelfProfile} from './formats/jsSelfProfile';
import {SampledProfile} from './formats/sampledProfile';
import {Profile} from './profile';
import {createFrameIndex, wrapWithSpan} from './utils';

export interface ImportOptions {
  transaction: Transaction;
}

export interface ProfileGroup {
  activeProfileIndex: number;
  name: string;
  profiles: Profile[];
  traceID: string;
}

// Importing functionality for each profile type.
function importJSSelfProfile(
  input: JSSelfProfiling.Trace,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex(input.frames);

  return {
    traceID,
    name: traceID,
    activeProfileIndex: 0,
    profiles: [importSingleProfile(input, frameIndex, options)],
  };
}

function importSingleProfile(
  profile: Profiling.ProfileTypes,
  frameIndex: ReturnType<typeof createFrameIndex>,
  {transaction}: ImportOptions
): Profile {
  if (isEventedProfile(profile)) {
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
    return wrapWithSpan(
      transaction,
      () => JSSelfProfile.FromProfile(profile, createFrameIndex(profile.frames)),
      {
        op: 'profile.import',
        description: 'js-self-profile',
      }
    );
  }

  if (isChromeTraceFormat(profile)) {
    return wrapWithSpan(transaction, () => ChromeTraceProfile.FromProfile(), {
      op: 'profile.import',
      description: 'js-self-profile',
    });
  }

  throw new Error('Unrecognized trace format');
}

export function importProfile(
  input: Profiling.Schema | JSSelfProfiling.Trace | ChromeTrace.ProfileType,
  traceID: string
): ProfileGroup {
  const transaction = Sentry.startTransaction({
    op: 'import',
    name: 'profiles.import',
  });

  try {
    if (isJSProfile(input)) {
      transaction.setTag('profile.type', 'js-self-profile');
      return importJSSelfProfile(input, traceID, {transaction});
    }

    if (isChromeTraceFormat(input)) {
      transaction.setTag('profile.type', 'chrometrace');
      return importChromeTraceProfile(input, traceID, {transaction});
    }

    if (isSchema(input)) {
      transaction.setTag('profile.type', 'schema');
      return importSchema(input, traceID, {transaction});
    }

    throw new Error('Unsupported trace format');
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
}

function importSchema(
  input: Profiling.Schema,
  traceID: string,
  options: ImportOptions
): ProfileGroup {
  const frameIndex = createFrameIndex(input.shared.frames);

  return {
    traceID,
    name: input.name,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    profiles: input.profiles.map(profile =>
      importSingleProfile(profile, frameIndex, options)
    ),
  };
}
