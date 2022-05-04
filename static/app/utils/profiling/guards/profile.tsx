export function isSchema(input: any): input is Profiling.Schema {
  return (
    typeof input === 'object' &&
    'transactionName' in input &&
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

export function isChromeTraceFormat(input: any): input is ChromeTrace.ProfileType {
  return isChromeTraceArrayFormat(input) || isChromeTraceObjectFormat(input);
}

export function isChromeTraceObjectFormat(input: any): input is ChromeTrace.ObjectFormat {
  return typeof input === 'object' && 'traceEvents' in input;
}

export function isChromeTraceArrayFormat(input: any): input is ChromeTrace.ArrayFormat {
  // @TODO we need to check if the profile actually includes the v8 profile nodes.
  return Array.isArray(input);
}
