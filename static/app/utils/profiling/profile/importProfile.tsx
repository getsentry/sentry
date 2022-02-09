import {isEventedProfile, isJSProfile, isSampledProfile} from '../guards/profile';

import {EventedProfile} from './eventedProfile';
import {JSSelfProfile} from './jsSelfProfile';
import {Profile} from './profile';
import {SampledProfile} from './sampledProfile';
import {createFrameIndex} from './utils';

export interface ProfileGroup {
  name: string;
  traceID: string;
  activeProfileIndex: number;
  profiles: Profile[];
}

export function importProfile(input: Profiling.Schema, traceID: string): ProfileGroup {
  const frameIndex = createFrameIndex(input.shared.frames);

  return {
    traceID,
    name: input.name,
    activeProfileIndex: input.activeProfileIndex ?? 0,
    profiles: input.profiles.map(profile => {
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
    }),
  };
}
