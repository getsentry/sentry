function isChromeTraceObjectFormat(input: any): input is ChromeTrace.ObjectFormat {
  return typeof input === 'object' && 'traceEvents' in input;
}

function isChromeTraceArrayFormat(input: any): input is ChromeTrace.ArrayFormat {
  return Array.isArray(input);
}

export function parseChromeTrace(
  input: string | ChromeTrace.ProfileType
): ChromeTrace.ProfileType {
  if (isChromeTraceObjectFormat(input)) {
    return input;
  }
  if (isChromeTraceArrayFormat(input)) {
    return input;
  }

  throw new Error('Failed to parse trace input format');
}
