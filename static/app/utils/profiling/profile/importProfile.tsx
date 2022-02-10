import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
} from '../guards/profile';

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

export function importProfile(input: Profiling.Schema, traceID: string): ProfileGroup {
  const frameIndex = createFrameIndex(input.shared.frames);

  return {
    traceID,
    name: input.name,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    profiles: input.profiles.map(profile => importSingleProfile(profile, frameIndex)),
  };
}

function readFileAsString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && typeof e.target.result === 'string') {
        resolve(e.target.result);
        return;
      }

      reject('Failed to read string contents of input file');
    };

    reader.onerror = () => {
      reject('Failed to read string contents of input file');
    };

    reader.readAsText(file);
  });
}

export function importDroppedProfile(file: File): Promise<ProfileGroup> {
  return new Promise((resolve, reject) => {
    readFileAsString(file)
      .then(fileContents => JSON.parse(fileContents))
      .then(json => {
        if (json === null || isNaN(json)) {
          reject('Input JSON is not an object');
          return;
        }

        if (isSchema(json)) {
          resolve(importProfile(json, ''));
          return;
        }

        if (isJSProfile(json)) {
          resolve({
            name: 'JS Self Profiling',
            activeProfileIndex: 0,
            traceID: '',
            profiles: [JSSelfProfile.FromProfile(json, createFrameIndex(json.frames))],
          });
          return;
        }

        throw new Error('Unsupported JSON format');
      })
      .catch(e => reject(e));
  });
}
