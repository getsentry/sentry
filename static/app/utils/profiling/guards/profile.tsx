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

export function isChromeTraceObjectFormat(input: any): input is ChromeTrace.ObjectFormat {
  return typeof input === 'object' && 'traceEvents' in input;
}

export function isChromeTraceArrayFormat(input: any): input is ChromeTrace.ProfileType {
  return (
    Array.isArray(input) && !!input.find(p => p.ph === 'P' && p.name === 'ProfileChunk')
  );
}

// Typescript uses only a subset of the event types, so we need to
// inspect the contents of the trace to determine the type of the profile.
export function isTypescriptChromeTraceArrayFormat(
  input: any
): input is ChromeTrace.ArrayFormat {
  return (
    Array.isArray(input) && !input.some(p => p.ph === 'P' && p.name === 'ProfileChunk')
  );
}

export function isChromeTraceFormat(input: any): input is ChromeTrace.ArrayFormat {
  return (
    isTypescriptChromeTraceArrayFormat(input) ||
    isChromeTraceObjectFormat(input) ||
    isChromeTraceArrayFormat(input)
  );
}
