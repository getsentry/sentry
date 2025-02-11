import partition from 'lodash/partition';
import * as qs from 'query-string';

import getThreadException from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import {FILTER_MASK} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import type {Image} from 'sentry/types/debugImage';
import type {EntryRequest, EntryThreads, Event, Frame, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {fileExtensionToPlatform, getFileExtension} from 'sentry/utils/fileExtension';

/**
 * Attempts to escape a string from any bash double quote special characters.
 */
function escapeBashString(v: string) {
  return v.replace(/(["$`\\])/g, '\\$1');
}
interface ImageForAddressProps {
  addrMode: Frame['addrMode'];
  address: Frame['instructionAddr'];
  event: Event;
}

interface HiddenFrameIndicesProps {
  data: StacktraceType;
  frameCountMap: {[frameIndex: number]: number};
  toggleFrameMap: {[frameIndex: number]: boolean};
}

export function findImageForAddress({event, addrMode, address}: ImageForAddressProps) {
  const images = event.entries.find(entry => entry.type === 'debugmeta')?.data?.images;

  if (!images || !address) {
    return null;
  }

  const image = images.find((img: any, idx: any) => {
    if (!addrMode || addrMode === 'abs') {
      const [startAddress, endAddress] = getImageRange(img);
      return address >= (startAddress as any) && address < (endAddress as any);
    }

    return addrMode === `rel:${idx}`;
  });

  return image;
}

export function isRepeatedFrame(frame: Frame, nextFrame?: Frame) {
  if (!nextFrame) {
    return false;
  }
  return (
    frame.lineNo === nextFrame.lineNo &&
    frame.instructionAddr === nextFrame.instructionAddr &&
    frame.package === nextFrame.package &&
    frame.module === nextFrame.module &&
    frame.function === nextFrame.function
  );
}

export function getRepeatedFrameIndices(data: StacktraceType) {
  const repeats: number[] = [];
  (data.frames ?? []).forEach((frame, frameIdx) => {
    const nextFrame = (data.frames ?? [])[frameIdx + 1];
    const repeatedFrame = isRepeatedFrame(frame, nextFrame);

    if (repeatedFrame) {
      repeats.push(frameIdx);
    }
  });
  return repeats;
}

export function getHiddenFrameIndices({
  data,
  toggleFrameMap,
  frameCountMap,
}: HiddenFrameIndicesProps) {
  const repeatedIndeces = getRepeatedFrameIndices(data);
  let hiddenFrameIndices: number[] = [];
  Object.keys(toggleFrameMap)
    // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
    .filter(frameIndex => toggleFrameMap[frameIndex] === true)
    .forEach(indexString => {
      const index = parseInt(indexString, 10);
      const indicesToBeAdded: number[] = [];
      let i = 1;
      let numHidden = frameCountMap[index]!;
      while (numHidden > 0) {
        if (!repeatedIndeces.includes(index - i)) {
          indicesToBeAdded.push(index - i);
          numHidden -= 1;
        }
        i += 1;
      }
      hiddenFrameIndices = [...hiddenFrameIndices, ...indicesToBeAdded];
    });
  return hiddenFrameIndices;
}

export function getLastFrameIndex(frames: Frame[]) {
  const inAppFrameIndexes = frames
    .map((frame, frameIndex) => {
      if (frame.inApp) {
        return frameIndex;
      }
      return undefined;
    })
    .filter(frame => frame !== undefined);

  return !inAppFrameIndexes.length
    ? frames.length - 1
    : inAppFrameIndexes[inAppFrameIndexes.length - 1];
}

// TODO(dcramer): support cookies
export function getCurlCommand(data: EntryRequest['data']) {
  let result = 'curl';

  if (defined(data.method) && data.method !== 'GET') {
    result += ' \\\n -X ' + data.method;
  }

  const headers =
    data.headers
      ?.filter(defined)
      // sort headers
      .sort(function (a, b) {
        return a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1;
      }) ?? [];

  // TODO(benvinegar): just gzip? what about deflate?
  const compressed = headers?.find(
    h => h[0] === 'Accept-Encoding' && h[1].includes('gzip')
  );
  if (compressed) {
    result += ' \\\n --compressed';
  }

  for (const header of headers) {
    result += ' \\\n -H "' + header[0] + ': ' + escapeBashString(header[1] + '') + '"';
  }

  if (defined(data.data)) {
    switch (data.inferredContentType) {
      case 'application/json':
        result += ' \\\n --data "' + escapeBashString(JSON.stringify(data.data)) + '"';
        break;
      case 'application/x-www-form-urlencoded':
        result +=
          ' \\\n --data "' +
          escapeBashString(qs.stringify(data.data as {[key: string]: any})) +
          '"';
        break;

      default:
        if (typeof data.data === 'string') {
          result += ' \\\n --data "' + escapeBashString(data.data) + '"';
        }
      // It is common for `data.inferredContentType` to be
      // "multipart/form-data" or "null", in which case, we do not attempt to
      // serialize the `data.data` object as port of the cURL command.
      // See https://github.com/getsentry/sentry/issues/71456
    }
  }

  result += ' \\\n "' + getFullUrl(data) + '"';
  return result;
}

export function stringifyQueryList(
  query: string | Array<[key: string, value: string] | null>
) {
  if (typeof query === 'string') {
    return query;
  }

  const queryObj: Record<string, string[]> = {};
  for (const kv of query) {
    if (kv !== null && kv.length === 2) {
      const [key, value] = kv;
      if (value !== null) {
        if (Array.isArray(queryObj[key])) {
          queryObj[key].push(value);
        } else {
          queryObj[key] = [value];
        }
      }
    }
  }
  return qs.stringify(queryObj);
}

export function getFullUrl(data: EntryRequest['data']): string | undefined {
  let fullUrl = data?.url;
  if (!fullUrl) {
    return fullUrl;
  }

  if (data?.query?.length) {
    fullUrl += '?' + stringifyQueryList(data.query);
  }

  if (data.fragment) {
    fullUrl += '#' + data.fragment;
  }

  return escapeBashString(fullUrl);
}

/**
 * Converts an object of body/querystring key/value pairs
 * into a tuple of [key, value] pairs, and sorts them.
 *
 * This handles the case for query strings that were decoded like so:
 *
 *   ?foo=bar&foo=baz => { foo: ['bar', 'baz'] }
 *
 * By converting them to [['foo', 'bar'], ['foo', 'baz']]
 */
export function objectToSortedTupleArray(obj: Record<string, string | string[]>) {
  return Object.keys(obj)
    .reduce<Array<[string, string]>>((out, k) => {
      const val = obj[k];
      return out.concat(
        Array.isArray(val)
          ? val.map(v => [k, v]) // key has multiple values (array)
          : ([[k, val]] as Array<[string, string]>) // key has single value
      );
    }, [])
    .sort(function ([keyA, valA], [keyB, valB]) {
      // if keys are identical, sort on value
      if (keyA === keyB) {
        return valA < valB ? -1 : 1;
      }

      return keyA < keyB ? -1 : 1;
    });
}

function isValidContextValue(value: unknown): value is string {
  return typeof value === 'string' && value !== FILTER_MASK;
}

const userAvatarKeys = ['id', 'ip', 'username', 'ip_address', 'name', 'email'] as const;

/**
 * Convert a user context object to an actor object for avatar display
 */
export function userContextToActor(rawData: Record<string, unknown>): AvatarUser {
  const result: Partial<AvatarUser> = {};

  for (const key of userAvatarKeys) {
    if (isValidContextValue(rawData[key])) {
      result[key] = rawData[key];
    }
  }

  return result as AvatarUser;
}

export function formatAddress(address: number, imageAddressLength: number | undefined) {
  return `0x${address.toString(16).padStart(imageAddressLength ?? 0, '0')}`;
}

export function parseAddress(address?: string | null) {
  if (!address) {
    return 0;
  }

  try {
    return parseInt(address, 16) || 0;
  } catch (_e) {
    return 0;
  }
}

export function getImageRange(image: Image) {
  // The start address is normalized to a `0x` prefixed hex string. The event
  // schema also allows ingesting plain numbers, but this is converted during
  // ingestion.
  const startAddress = parseAddress(image?.image_addr);

  // The image size is normalized to a regular number. However, it can also be
  // `null`, in which case we assume that it counts up to the next image.
  const endAddress = startAddress + (image?.image_size || 0);

  return [startAddress, endAddress];
}

export function parseAssembly(assembly: string | null) {
  let name: string | undefined;
  let version: string | undefined;
  let culture: string | undefined;
  let publicKeyToken: string | undefined;

  const pieces = assembly ? assembly.split(',') : [];

  if (pieces.length > 0) {
    name = pieces[0];
  }

  for (let i = 1; i < pieces.length; i++) {
    const [key, value] = pieces[i]!.trim().split('=');

    // eslint-disable-next-line default-case
    switch (key) {
      case 'Version':
        version = value;
        break;
      case 'Culture':
        if (value !== 'neutral') {
          culture = value;
        }
        break;
      case 'PublicKeyToken':
        if (value !== 'null') {
          publicKeyToken = value;
        }
        break;
    }
  }

  return {name, version, culture, publicKeyToken};
}

function getFramePlatform(frame: Frame) {
  const fileExtension = getFileExtension(frame.filename ?? '');
  const fileExtensionPlatform = fileExtension
    ? fileExtensionToPlatform(fileExtension)
    : null;

  if (fileExtensionPlatform) {
    return fileExtensionPlatform;
  }

  if (frame.platform) {
    return frame.platform;
  }

  return null;
}

/**
 * Returns the representative platform for the given stack trace frames.
 * Prioritizes recent in-app frames, checking first for a matching file extension
 * and then for a frame.platform attribute [1].
 *
 * If none of the frames have a platform, falls back to the event platform.
 *
 * [1] https://develop.sentry.dev/sdk/event-payloads/stacktrace/#frame-attributes
 */
export function stackTracePlatformIcon(eventPlatform: PlatformKey, frames: Frame[]) {
  const [inAppFrames, systemFrames] = partition(
    // Reverse frames to get newest-first ordering
    [...frames].reverse(),
    frame => frame.inApp
  );

  for (const frame of [...inAppFrames, ...systemFrames]) {
    const framePlatform = getFramePlatform(frame);

    if (framePlatform) {
      return framePlatform;
    }
  }

  return eventPlatform;
}

export function isStacktraceNewestFirst() {
  const user = ConfigStore.get('user');
  // user may not be authenticated

  if (!user) {
    return true;
  }

  switch (user.options.stacktraceOrder) {
    case 2:
      return true;
    case 1:
      return false;
    case -1:
    default:
      return true;
  }
}

export function getCurrentThread(event: Event) {
  const threads = event.entries?.find(entry => entry.type === EntryType.THREADS) as
    | EntryThreads
    | undefined;
  return threads?.data.values?.find(thread => thread.current);
}

export function getThreadById(event: Event, tid?: number) {
  const threads = event.entries?.find(entry => entry.type === EntryType.THREADS) as
    | EntryThreads
    | undefined;
  return threads?.data.values?.find(thread => thread.id === tid);
}

export function getStacktracePlatform(
  event: Event,
  stacktrace?: StacktraceType | null
): PlatformKey {
  const overridePlatform = stacktrace?.frames?.find(frame =>
    defined(frame.platform)
  )?.platform;

  return overridePlatform ?? event.platform ?? 'other';
}

export function inferPlatform(event: Event, thread?: Thread): PlatformKey {
  const exception = getThreadException(event, thread);
  let exceptionFramePlatform: Frame | undefined = undefined;

  for (const value of exception?.values ?? []) {
    exceptionFramePlatform = value.stacktrace?.frames?.find(frame => !!frame.platform);
    if (exceptionFramePlatform) {
      break;
    }
  }

  if (exceptionFramePlatform?.platform) {
    return exceptionFramePlatform.platform;
  }

  const threadFramePlatform = thread?.stacktrace?.frames?.find(frame => !!frame.platform);

  if (threadFramePlatform?.platform) {
    return threadFramePlatform.platform;
  }

  return event.platform ?? 'other';
}
