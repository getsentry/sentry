export function isEventedProfile(
  profile: Profiling.ProfileTypes
): profile is Profiling.EventedProfile {
  return profile?.type === 'evented';
}

export function isSampledProfile(
  profile: Profiling.ProfileTypes
): profile is Profiling.SampledProfile {
  return profile?.type === 'sampled';
}

export function isJSProfile(
  profile: Profiling.ProfileTypes
): profile is JSSelfProfiling.Trace {
  return Array.isArray(profile.resources);
}
