import {isEventedProfile, isJSProfile, isSampledProfile} from '../guards/profile';

import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import {Profile} from './profile';
import {SampledProfile} from './sampledProfile';

export interface ProfileGroup {
  activeProfileIndex: number;
  name: string;
  profiles: Profile[];
  traceID: string;
}

type ProfileType =
  | Profiling.EventedProfile
  | Profiling.SampledProfile
  | JSSelfProfiling.Trace;

interface Schema {
  activeProfileIndex: number;
  name: string;
  profiles: ProfileType[];
}

export function importProfile(input: Schema, traceID: string): ProfileGroup {
  return {
    traceID,
    name: input.name,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    profiles: input.profiles.map(profile => {
      if (isEventedProfile(profile)) {
        return EventedProfile.FromProfile(profile);
      }
      if (isSampledProfile(profile)) {
        return SampledProfile.FromProfile(profile);
      }
      if (isJSProfile(profile)) {
        return JSSelfProfile.FromProfile(profile);
      }
      throw new Error('Unrecognized trace format');
    }),
  };
}
