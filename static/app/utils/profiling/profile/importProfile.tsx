import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
} from '../guards/profile';

import {importChromeTrace, isChromeTraceFormat} from './chromeTraceProfile';
import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import {Profile} from './profile';
import {SampledProfile} from './sampledProfile';
import {createFrameIndex} from './utils';

export interface ProfileGroup {
  activeProfileIndex: number;
  name: string;
  profiles: Profile[];
  traceID: string;
}

function importSingleProfile(
  profile: Profiling.ProfileTypes,
  frameIndex: ReturnType<typeof createFrameIndex>
): Profile {
  if (isEventedProfile(profile)) {
    return EventedProfile.FromProfile(profile, frameIndex);
  }
  if (isSampledProfile(profile)) {
    return SampledProfile.FromProfile(profile, frameIndex);
  }
  if (isJSProfile(profile)) {
    return JSSelfProfile.FromProfile(profile, createFrameIndex(profile.frames));
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

export const TRACE_JSON_PARSERS: ((string) => ReturnType<JSONParser>)[] = [
  (input: string) => tryParseInputString(input),
  (input: string) => tryParseInputString(input + ']'),
];

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

export function importProfile(
  input: Profiling.Schema | JSSelfProfiling.Trace,
  traceID: string
): ProfileGroup {
  if (isJSProfile(input)) {
    return importJSSelfProfile(input, traceID);
  }

  if (isChromeTraceFormat(input)) {
    return importChromeTrace(input);
  }

  if (isSchema(input)) {
    const frameIndex = createFrameIndex(input.shared.frames);

    return {
      traceID,
      name: input.name,
      activeProfileIndex: input.activeProfileIndex ?? 0,
      profiles: input.profiles.map(profile => importSingleProfile(profile, frameIndex)),
    };
  }

  throw new Error('Unsupported trace format');
}

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
  try {
    return await readFileAsString(file)
      .then(fileContents => {
        for (const parser of parsers) {
          const [result] = parser(fileContents);

          if (result) {
            return result;
          }
        }

        throw new Error('Failed to parse input JSON');
      })
      .then(json => {
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
          return importChromeTrace(json);
        }

        throw new Error('Unsupported JSON format');
      });
  } catch (e) {
    throw e;
  }
}
