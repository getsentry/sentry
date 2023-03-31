export function isSchema(input: any): input is Profiling.Schema {
  return (
    typeof input === 'object' &&
    // 'metadata' in input &&
    'profiles' in input &&
    Array.isArray(input.profiles) &&
    'shared' in input
  );
}

export function isEventedProfile(profile: any): profile is Profiling.EventedProfile {
  return 'type' in profile && profile.type === 'evented';
}

export function isSampledProfile(profile: any): profile is Profiling.SampledProfile {
  return 'type' in profile && profile.type === 'sampled';
}

export function isJSProfile(profile: any): profile is JSSelfProfiling.Trace {
  return !('type' in profile) && Array.isArray(profile.resources);
}

export function isSentrySampledProfile(
  profile: any
): profile is Profiling.SentrySampledProfile {
  return (
    'profile' in profile &&
    'samples' in profile.profile &&
    'stacks' in profile.profile &&
    'frames' in profile.profile
  );
}
