export function isEventedProfile(
  profile: Profiling.ProfileTypes
): profile is Profiling.EventedProfile {
  return 'type' in profile && profile.type === 'evented';
}

export function isSampledProfile(
  profile: Profiling.ProfileTypes
): profile is Profiling.SampledProfile {
  return 'type' in profile && profile.type === 'sampled';
}

export function isJSProfile(
  profile: Profiling.ProfileTypes
): profile is JSSelfProfiling.Trace {
  return !('type' in profile) && Array.isArray(profile.resources);
}
