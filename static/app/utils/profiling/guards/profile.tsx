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

// We check for the presence of at least one ProfileChunk event in the trace
export function isChromeTraceArrayFormat(input: any): input is ChromeTrace.ProfileType {
  return (
    Array.isArray(input) && input.some(p => p.ph === 'P' && p.name === 'ProfileChunk')
  );
}

// Typescript uses only a subset of the event types (only B and E cat),
// so we need to inspect the contents of the trace to determine the type of the profile.
// The TS trace can still contain other event types like metadata events, meaning we cannot
// use array.every() and need to check all the events to make sure no P events are present
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
