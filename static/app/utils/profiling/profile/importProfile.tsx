import {
  isChromeTraceArrayFormat,
  isChromeTraceFormat,
  isChromeTraceObjectFormat,
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
} from '../guards/profile';

import {parseChromeTraceArrayFormat} from './chromeTraceProfile';
import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import {Profile} from './profile';
import {SampledProfile} from './sampledProfile';
import {createFrameIndex, wrapWithSpan} from './utils';

export interface ProfileGroup {
  activeProfileIndex: number;
  name: string;
  profiles: Profile[];
  traceID: string;
}

export function importProfile(
  input: Profiling.Schema | JSSelfProfiling.Trace | ChromeTrace.ProfileType,
  traceID: string
): ProfileGroup {
  return wrapWithSpan(() => _importProfile(input, traceID), {op: 'profiles.import'});
}

function _importProfile(
  input: Profiling.Schema | JSSelfProfiling.Trace | ChromeTrace.ProfileType,
  traceID: string
): ProfileGroup {
  if (isJSProfile(input)) {
    return importJSSelfProfile(input, traceID);
  }

  if (isChromeTraceFormat(input)) {
    return importChromeTrace(input, traceID);
  }

  if (isSchema(input)) {
    return importSchema(input, traceID);
  }

  throw new Error('Unsupported trace format');
}

function importJSSelfProfile(
  input: JSSelfProfiling.Trace,
  traceID: string
): ProfileGroup {
  const frameIndex = createFrameIndex(input.frames);

  return {
    traceID,
    name: traceID,
    activeProfileIndex: 0,
    profiles: [importSingleProfile(input, frameIndex)],
  };
}

function importChromeTrace(
  input: ChromeTrace.ProfileType,
  traceID: string
): ProfileGroup {
  if (isChromeTraceObjectFormat(input)) {
    throw new Error('Chrometrace object format is not yet supported');
  }

  if (isChromeTraceArrayFormat(input)) {
    return parseChromeTraceArrayFormat(input, traceID);
  }

  throw new Error('Failed to parse trace input format');
}

function importSchema(input: Profiling.Schema, traceID: string): ProfileGroup {
  const frameIndex = createFrameIndex(input.shared.frames);

  return {
    traceID,
    name: input.name,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    profiles: input.profiles.map(profile => importSingleProfile(profile, frameIndex)),
  };
}

function importSingleProfile(
  profile: Profiling.ProfileTypes,
  frameIndex: ReturnType<typeof createFrameIndex>
): Profile {
  if (isEventedProfile(profile)) {
    return wrapWithSpan(() => EventedProfile.FromProfile(profile, frameIndex), {
      op: 'profile.import',
      description: 'evented',
    });
  }
  if (isSampledProfile(profile)) {
    return wrapWithSpan(() => SampledProfile.FromProfile(profile, frameIndex), {
      op: 'profile.import',
      description: 'sampled',
    });
  }
  if (isJSProfile(profile)) {
    return wrapWithSpan(
      () => JSSelfProfile.FromProfile(profile, createFrameIndex(profile.frames)),
      {
        op: 'profile.import',
        description: 'js',
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

      if (isSchema(json)) {
        return importProfile(json, file.name);
      }

      if (isJSProfile(json)) {
        return importJSSelfProfile(json, file.name);
      }

      if (isChromeTraceFormat(json)) {
        return importChromeTrace(json, file.name);
      }

      throw new Error('Unsupported JSON format');
    }
  }

  throw new Error('Failed to parse input JSON');
}
