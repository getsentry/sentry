import {IconQuestion, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {isUrl} from 'sentry/utils/string/isUrl';

import {SymbolicatorStatus} from '../types';

export function trimPackage(pkg: string) {
  const pieces = pkg.split(/^([a-z]:\\|\\\\)/i.test(pkg) ? '\\' : '/');
  const filename = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  return filename.replace(/\.(dylib|so|a|dll|exe)$/, '');
}

export function getPlatform(dataPlatform: PlatformKey | null, platform: string) {
  // prioritize the frame platform but fall back to the platform
  // of the stack trace / exception
  return dataPlatform || platform;
}

export function getFrameHint(frame: Frame) {
  // returning [hintText, hintIcon]
  const {symbolicatorStatus} = frame;
  const func = frame.function || '<unknown>';
  // Custom color used to match adjacent text.
  const warningIcon = <IconQuestion size="xs" color={'#2c45a8' as any} />;
  const errorIcon = <IconWarning size="xs" color="red300" />;

  if (func.match(/^@objc\s/)) {
    return [t('Objective-C -> Swift shim frame'), warningIcon];
  }
  if (func.match(/^__?hidden#\d+/)) {
    return [t('Hidden function from bitcode build'), errorIcon];
  }
  if (!symbolicatorStatus && func === '<unknown>') {
    // Only render this if the event was not symbolicated.
    return [t('No function name was supplied by the client SDK.'), warningIcon];
  }

  if (
    func === '<unknown>' ||
    (func === '<redacted>' && symbolicatorStatus === SymbolicatorStatus.MISSING_SYMBOL)
  ) {
    switch (symbolicatorStatus) {
      case SymbolicatorStatus.MISSING_SYMBOL:
        return [t('The symbol was not found within the debug file.'), warningIcon];
      case SymbolicatorStatus.UNKNOWN_IMAGE:
        return [t('No image is specified for the address of the frame.'), warningIcon];
      case SymbolicatorStatus.MISSING:
        return [
          t('The debug file could not be retrieved from any of the sources.'),
          errorIcon,
        ];
      case SymbolicatorStatus.MALFORMED:
        return [t('The retrieved debug file could not be processed.'), errorIcon];
      default:
    }
  }

  if (func === '<redacted>') {
    return [t('Unknown system frame. Usually from beta SDKs'), warningIcon];
  }

  return [null, null];
}

export function isDotnet(platform: string) {
  // csharp platform represents .NET and can be F#, VB or any language targeting CLS (the Common Language Specification)
  return platform === 'csharp';
}

export function hasContextSource(frame: Frame) {
  return defined(frame.context) && !!frame.context.length;
}

export function hasContextVars(frame: Frame) {
  return !isEmptyObject(frame.vars || {});
}

export function hasContextRegisters(registers: Record<string, string>) {
  return !isEmptyObject(registers);
}

export function hasAssembly(frame: Frame, platform?: string) {
  return (
    isDotnet(getPlatform(frame.platform, platform ?? 'other')) && defined(frame.package)
  );
}

export function isExpandable({
  frame,
  registers,
  emptySourceNotation,
  platform,
  isOnlyFrame,
}: {
  frame: Frame;
  registers: Record<string, string>;
  emptySourceNotation?: boolean;
  isOnlyFrame?: boolean;
  platform?: string;
}) {
  return (
    (!isOnlyFrame && emptySourceNotation) ||
    hasContextSource(frame) ||
    hasContextVars(frame) ||
    hasContextRegisters(registers) ||
    hasAssembly(frame, platform)
  );
}

export function getLeadHint({
  event,
  hasNextFrame,
}: {
  event: Event;
  hasNextFrame: boolean;
}) {
  if (hasNextFrame) {
    return t('Called from');
  }

  switch (event.type) {
    case EventOrGroupType.ERROR:
      // ANRs/AppHangs are errors, but not crashes, so "Crashed in non-app" might be confusing as if
      // there was a crash prior to ANR, hence special-casing them
      return isAnrEvent(event) ? t('Occurred in non-app') : t('Crashed in non-app');
    default:
      return t('Occurred in non-app');
  }
}

function isAnrEvent(event: Event) {
  const mechanismTag = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR =
    mechanismTag === 'ANR' ||
    mechanismTag === 'AppExitInfo' ||
    mechanismTag === 'AppHang' ||
    mechanismTag === 'mx_hang_diagnostic';
  return isANR;
}

export function hasFileExtension(filepath: string) {
  // Regular expression to match a file extension
  const fileExtensionPattern = /\.[0-9a-z]+$/i;

  // Check if the filepath matches the pattern
  return fileExtensionPattern.test(filepath);
}

/**
 * Extracts the origin URL from an event
 *
 * TODO: Should consider other sources of origin besides just url tag
 *
 * @param event The event to extract the origin from
 * @returns The origin URL string, or empty string if not found/invalid
 */
function extractEventOrigin(event: Event): string {
  const urlTag = event.tags.find(({key}) => key === 'url');

  if (!urlTag?.value) {
    return '';
  }

  try {
    const url = new URL(urlTag.value);
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Extracts the root domain from a URL string (e.g. "example.com" from "https://sub.example.com/path")
 *
 * @param url The URL string to extract the root domain from
 * @returns The root domain string, or empty string if URL is invalid
 */
function getRootDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Split hostname into parts and get the last two parts (if they exist)
    const parts = hostname.split('.');
    return parts.slice(-2).join('.');
  } catch {
    return '';
  }
}

/**
 * Determines whether to display the absolute path in the frame title
 *
 * This helps identify frames from external domains vs the application's domain.
 *
 * @param frame The stack frame to check
 * @param event The event containing the frame
 * @returns True if the absolute path should be shown in the title
 */
export function shouldDisplayAbsPathInTitle(frame: Frame, event: Event): boolean {
  if (event.platform !== 'javascript') {
    return false;
  }

  const eventOrigin = extractEventOrigin(event);

  if (!frame.absPath || !isUrl(eventOrigin) || !isUrl(frame.absPath)) {
    return false;
  }

  const eventRootDomain = getRootDomain(eventOrigin);
  const frameRootDomain = getRootDomain(frame.absPath);

  return eventRootDomain !== frameRootDomain;
}
