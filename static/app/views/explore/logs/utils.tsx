import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  type ColumnValueType,
  CurrencyUnit,
  DurationUnit,
  fieldAlignment,
} from 'sentry/utils/discover/fields';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {LogAttributesHumanLabel} from 'sentry/views/explore/logs/constants';
import {
  type LogAttributeItem,
  type LogAttributeUnits,
  type LogRowItem,
  type OurLogFieldKey,
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

const {warn, fmt} = Sentry.logger;

export function getLogSeverityLevel(
  severityNumber: number | null,
  severityText: string | null
): SeverityLevel {
  // Defer to the severity number if it is provided
  // Currently follows https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
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

  // If the severity number isn't in range or the severity text can't map to a level, the severity level is unknown.
  return SeverityLevel.UNKNOWN;
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
    [SeverityLevel.TRACE]: t('TRACE'),
    [SeverityLevel.DEBUG]: t('DEBUG'),
    [SeverityLevel.INFO]: t('INFO'),
    [SeverityLevel.WARN]: t('WARN'),
    [SeverityLevel.ERROR]: t('ERROR'),
    [SeverityLevel.FATAL]: t('FATAL'),
    [SeverityLevel.DEFAULT]: t('DEFAULT'),
    [SeverityLevel.UNKNOWN]: t('UNKNOWN'), // Maps to info for now.
  }[level];
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

export function logsFieldAlignment(...args: Parameters<typeof fieldAlignment>) {
  const field = args[0];
  if (field === OurLogKnownFieldKey.TIMESTAMP) {
    return 'right';
  }
  return fieldAlignment(...args);
}

export function removePrefixes(key: string) {
  return key.replace('log.', '').replace('sentry.', '');
}

export function adjustAliases(key: string) {
  switch (key) {
    case 'sentry.project_id':
      warn(
        fmt`Field ${key} is deprecated. Please use ${OurLogKnownFieldKey.PROJECT_ID} instead.`
      );
      return OurLogKnownFieldKey.PROJECT_ID; // Public alias since int<->string alias reversing is broken. Should be removed in the future.
    default:
      return key;
  }
}

export function getTableHeaderLabel(field: OurLogFieldKey) {
  return LogAttributesHumanLabel[field] ?? removePrefixes(field);
}

export function isLogAttributeUnit(unit: string | null): unit is LogAttributeUnits {
  return (
    unit === null ||
    unit === `${DurationUnit}` ||
    unit === `${CurrencyUnit}` ||
    unit === 'count' ||
    unit === 'percentage' ||
    unit === 'percent_change'
  );
}

export function getLogRowItem(
  field: OurLogFieldKey,
  dataRow: OurLogsResponseItem,
  meta: EventsMetaType | undefined
): LogRowItem {
  if (!defined(dataRow[field])) {
    warn(fmt`Field ${field} in not defined in dataRow ${dataRow}`);
  }

  return {
    fieldKey: field,
    metaFieldType: meta?.fields?.[field] as ColumnValueType,
    unit: isLogAttributeUnit(meta?.units?.[field] ?? null)
      ? (meta?.units?.[field] as LogAttributeUnits)
      : null,
    value: dataRow[field] ?? '',
  };
}

export function getLogAttributeItem(
  field: OurLogFieldKey,
  value: OurLogsResponseItem[OurLogFieldKey] | null
): LogAttributeItem {
  return {
    fieldKey: field,
    value,
  };
}

export function logRowItemToTableColumn(
  item: LogRowItem
): TableColumn<keyof TableDataRow> {
  return {
    key: item.fieldKey,
    name: item.fieldKey,
    column: {
      field: item.fieldKey,
      kind: 'field',
    },
    isSortable: false,
    type: item.metaFieldType,
  };
}

export function adjustLogTraceID(traceID: string) {
  return traceID.replace(/-/g, '');
}
