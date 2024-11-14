import * as Sentry from '@sentry/react';

const fileDebugIdCache = new Map<string, string>();

/**
 * This function simulates having a browser API that takes an error and returns
 * a map of filenames and debug IDs for the error's stack trace.
 *
 * A real browser API would probably not be async - we need it to be async
 * because internally, this functions works by refetching source files to read
 * the debug ID comment at the bottom from the file's contents.
 *
 * RFC related to this: https://github.com/getsentry/rfcs/blob/main/text/0081-sourcemap-debugid.md
 */
export async function getErrorDebugIds(e: Error): Promise<{[filename: string]: string}> {
  if (!e.stack) {
    return {};
  }

  const stackFrames = Sentry.defaultStackParser(e.stack);

  const debugIdMap: Record<string, string> = {};

  const fetchTaskGenerators = stackFrames.map(stackFrame => async () => {
    if (!stackFrame.filename) {
      return;
    }

    const cacheEntry = fileDebugIdCache.get(stackFrame.filename);
    if (cacheEntry) {
      debugIdMap[stackFrame.filename] = cacheEntry;
      return;
    }

    try {
      const text = await fetch(stackFrame.filename).then(res => res.text());
      const debugIdMatch = text.match(/^\/\/# debugId=(\S+)/im);

      if (!debugIdMatch) {
        return;
      }

      fileDebugIdCache.set(stackFrame.filename, debugIdMatch[1]);
      debugIdMap[stackFrame.filename] = debugIdMatch[1];
    } catch {
      // noop
      return;
    }
  });

  const worker = async () => {
    let fetchTaskGenerator = fetchTaskGenerators.pop();
    while (fetchTaskGenerator) {
      await fetchTaskGenerator();
      fetchTaskGenerator = fetchTaskGenerators.pop();
    }
  };

  // Only fetch 5 files at once
  await Promise.all([worker(), worker(), worker(), worker(), worker()]);

  return debugIdMap;
}
