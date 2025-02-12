import {t} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function getLogSeverityLevel(
  severityNumber: number | null,
  severityText: string | null
): SeverityLevel {
  // Defer to the severity number if it is provided
  if (severityNumber) {
    if (severityNumber >= 1 && severityNumber <= 4) {
      return SeverityLevel.TRACE;
    }
    if (severityNumber >= 5 && severityNumber <= 8) {
      return SeverityLevel.DEBUG;
    }
    if (severityNumber >= 9 && severityNumber <= 12) {
      return SeverityLevel.INFO;
    }
    if (severityNumber >= 13 && severityNumber <= 16) {
      return SeverityLevel.WARN;
    }
    if (severityNumber >= 17 && severityNumber <= 20) {
      return SeverityLevel.ERROR;
    }
    if (severityNumber >= 21 && severityNumber <= 24) {
      return SeverityLevel.FATAL;
    }
  }

  // Otherwise use severity text if it's a case insensitive match for one of the severity levels
  if (severityText) {
    const upperText = severityText.toUpperCase();
    const validLevels = [
      SeverityLevel.TRACE,
      SeverityLevel.DEBUG,
      SeverityLevel.INFO,
      SeverityLevel.WARN,
      SeverityLevel.ERROR,
      SeverityLevel.FATAL,
      SeverityLevel.DEFAULT,
      SeverityLevel.UNKNOWN,
    ];
    if (validLevels.includes(upperText as SeverityLevel)) {
      return upperText as SeverityLevel;
    }
  }

  //
  return SeverityLevel.DEFAULT;
}

/**
 * This level is the source of truth for the severity level.
 * Currently overlaps with the OpenTelemetry log severity level, with the addition of DEFAULT and UNKNOWN.
 */
export enum SeverityLevel {
  // A fine-grained debugging event. Typically disabled in default configurations.
  TRACE = 'TRACE',
  // A debugging event.
  DEBUG = 'DEBUG',
  // An informational event. Indicates that an event happened.
  INFO = 'INFO',
  // A warning event. Not an error but is likely more important than an informational event.
  WARN = 'WARN',
  // An error event. Something went wrong.
  ERROR = 'ERROR',
  // A fatal error such as application or system crash.
  FATAL = 'FATAL',
  // The log entry has no assigned severity level.
  DEFAULT = 'DEFAULT',
  // Unknown severity level, no severity text or number provided.
  UNKNOWN = 'UNKNOWN',
}

/**
 * Maps all internal severity levels to the appropriate text level. Should all be 4 characters for display purposes.
 */
export function severityLevelToText(level: SeverityLevel) {
  return {
    [SeverityLevel.TRACE]: t('TRAC'),
    [SeverityLevel.DEBUG]: t('DEBU'),
    [SeverityLevel.INFO]: t('INFO'),
    [SeverityLevel.WARN]: t('WARN'),
    [SeverityLevel.ERROR]: t('ERRO'),
    [SeverityLevel.FATAL]: t('CRIT'),
    [SeverityLevel.DEFAULT]: t('DEFA'),
    [SeverityLevel.UNKNOWN]: t('INFO'), // Maps to info for now.
  }[level];
}

type SeverityColorLevel =
  | 'sample'
  | 'info'
  | 'warning'
  | 'error'
  | 'fatal'
  | 'default'
  | 'unknown';

/**
 * Maps all internal severity levels to the appropriate color level, making use of the existing issues colors to maintain consistency.
 */
export function severityLevelToColorLevel(level: SeverityLevel): SeverityColorLevel {
  return {
    [SeverityLevel.DEFAULT]: 'default',
    [SeverityLevel.TRACE]: 'info',
    [SeverityLevel.DEBUG]: 'info',
    [SeverityLevel.INFO]: 'info',
    [SeverityLevel.WARN]: 'warning',
    [SeverityLevel.ERROR]: 'error',
    [SeverityLevel.FATAL]: 'fatal',
    [SeverityLevel.UNKNOWN]: 'info',
  }[level] as SeverityColorLevel;
}

export function getLogBodySearchTerms(search: MutableSearch): string[] {
  const searchTerms: string[] = search.freeText.map(text => text.replaceAll('*', ''));
  const bodyFilters = search.getFilterValues('log.body');
  for (const filter of bodyFilters) {
    if (!filter.startsWith('!') && !filter.startsWith('[')) {
      searchTerms.push(filter);
    }
  }
  return searchTerms;
}
