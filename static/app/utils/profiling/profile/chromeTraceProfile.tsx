function tryParseInputString(input: string): any {
  try {
    return JSON.parse(input);
  } catch (e) {
    return null;
  }
}

function isChromeTraceObjectFormat(input: any): input is ChromeTrace.ObjectFormat {
  return typeof input === 'object' && 'traceEvents' in input;
}

function isChromeTraceArrayFormat(input: any): input is ChromeTrace.ArrayFormat {
  return Array.isArray(input);
}

export function parseChromeTrace(
  input: string | ChromeTrace.ProfileType
): ChromeTrace.ProfileType {
  if (typeof input === 'string') {
    const parsed = tryParseInputString(input) || tryParseInputString(input + ']');

    if (parsed) {
      return parsed;
    }

    throw new Error('Failed to parse trace input format');
  }

  if (isChromeTraceObjectFormat(input)) {
    return input;
  }
  if (isChromeTraceArrayFormat(input)) {
    return input;
  }

  throw new Error('Failed to parse trace input format');
}

function importChromeTrace(profile: ChromeTrace.ProfileType) {
  if (Array.isArray(profile)) {
  }
}
