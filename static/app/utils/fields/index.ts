import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {CONDITIONS_ARGUMENTS, WEB_VITALS_QUALITY} from 'sentry/utils/discover/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {SpanFields} from 'sentry/views/insights/types';

// Don't forget to update https://docs.sentry.io/product/sentry-basics/search/searchable-properties/ for any changes made here

export enum FieldKind {
  TAG = 'tag',
  FEATURE_FLAG = 'feature_flag',
  MEASUREMENT = 'measurement',
  BREAKDOWN = 'breakdown',
  FIELD = 'field',
  ISSUE_FIELD = 'issue_field',
  EVENT_FIELD = 'event_field',
  FUNCTION = 'function',
  EQUATION = 'equation',
  METRICS = 'metric',
  NUMERIC_METRICS = 'numeric_metric',
}

export enum FieldKey {
  AGE = 'age',
  ASSIGNED = 'assigned',
  ASSIGNED_OR_SUGGESTED = 'assigned_or_suggested',
  BOOKMARKS = 'bookmarks',
  BROWSER_NAME = 'browser.name',
  CULPRIT = 'culprit',
  DETECTOR = 'detector',
  DEVICE = 'device',
  DEVICE_ARCH = 'device.arch',
  DEVICE_BATTERY_LEVEL = 'device.battery_level',
  DEVICE_BRAND = 'device.brand',
  DEVICE_CHARGING = 'device.charging',
  // device.class is a synthesized field calculated based off device info found in context such
  // as model (for iOS devices), and device specs like processor_frequency (for Android devices).
  // https://github.com/getsentry/relay/blob/master/relay-general/src/protocol/device_class.rs
  DEVICE_CLASS = 'device.class',
  DEVICE_FAMILY = 'device.family',
  DEVICE_LOCALE = 'device.locale',
  DEVICE_MODEL_ID = 'device.model_id',
  DEVICE_NAME = 'device.name',
  DEVICE_ONLINE = 'device.online',
  DEVICE_ORIENTATION = 'device.orientation',
  DEVICE_SCREEN_DENSITY = 'device.screen_density',
  DEVICE_SCREEN_DPI = 'device.screen_dpi',
  DEVICE_SCREEN_HEIGHT_PIXELS = 'device.screen_height_pixels',
  DEVICE_SCREEN_WIDTH_PIXELS = 'device.screen_width_pixels',
  DEVICE_SIMULATOR = 'device.simulator',
  DEVICE_UUID = 'device.uuid',
  DIST = 'dist',
  ENVIRONMENT = 'environment',
  ERROR_HANDLED = 'error.handled',
  ERROR_MECHANISM = 'error.mechanism',
  ERROR_TYPE = 'error.type',
  ERROR_UNHANDLED = 'error.unhandled',
  ERROR_VALUE = 'error.value',
  ERROR_RECEIVED = 'error.received',
  ERROR_MAIN_THREAD = 'error.main_thread',
  EVENT_TIMESTAMP = 'event.timestamp',
  EVENT_TYPE = 'event.type',
  FIRST_RELEASE = 'firstRelease',
  FIRST_SEEN = 'firstSeen',
  GEO_CITY = 'geo.city',
  GEO_COUNTRY_CODE = 'geo.country_code',
  GEO_REGION = 'geo.region',
  GEO_SUBDIVISION = 'geo.subdivision',
  HAS = 'has',
  HTTP_METHOD = 'http.method',
  HTTP_REFERER = 'http.referer',
  HTTP_STATUS_CODE = 'http.status_code',
  HTTP_URL = 'http.url',
  ID = 'id',
  IS = 'is',
  ISSUE = 'issue',
  ISSUE_CATEGORY = 'issue.category',
  ISSUE_PRIORITY = 'issue.priority',
  ISSUE_SEER_ACTIONABILITY = 'issue.seer_actionability',
  ISSUE_SEER_LAST_RUN = 'issue.seer_last_run',
  ISSUE_TYPE = 'issue.type',
  LAST_SEEN = 'lastSeen',
  LEVEL = 'level',
  LOCATION = 'location',
  MESSAGE = 'message',
  OS = 'os',
  OS_BUILD = 'os.build',
  OS_KERNEL_VERSION = 'os.kernel_version',
  OS_NAME = 'os.name',
  OS_DISTRIBUTION_NAME = 'os.distribution_name',
  OS_DISTRIBUTION_VERSION = 'os.distribution_version',
  PLATFORM = 'platform',
  PLATFORM_NAME = 'platform.name',
  PROFILE_ID = 'profile.id',
  PROJECT = 'project',
  RELEASE = 'release',
  RELEASE_BUILD = 'release.build',
  RELEASE_PACKAGE = 'release.package',
  RELEASE_STAGE = 'release.stage',
  RELEASE_VERSION = 'release.version',
  REPLAY_ID = 'replayId',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  STACK_ABS_PATH = 'stack.abs_path',
  STACK_COLNO = 'stack.colno',
  STACK_FILENAME = 'stack.filename',
  STACK_FUNCTION = 'stack.function',
  STACK_IN_APP = 'stack.in_app',
  STACK_LINENO = 'stack.lineno',
  STACK_MODULE = 'stack.module',
  STACK_PACKAGE = 'stack.package',
  STACK_RESOURCE = 'stack.resource',
  STACK_STACK_LEVEL = 'stack.stack_level',
  STATUS = 'status',
  SYMBOLICATED_IN_APP = 'symbolicated_in_app',
  TIMESTAMP = 'timestamp',
  TIMESTAMP_TO_DAY = 'timestamp.to_day',
  TIMESTAMP_TO_HOUR = 'timestamp.to_hour',
  TIMES_SEEN = 'timesSeen',
  TITLE = 'title',
  TOTAL_COUNT = 'total.count',
  TRACE = 'trace',
  TRACE_PARENT_SPAN = 'trace.parent_span',
  TRACE_SPAN = 'trace.span',
  TRACE_CLIENT_SAMPLE_RATE = 'trace.client_sample_rate',
  TRANSACTION = 'transaction',
  TRANSACTION_DURATION = 'transaction.duration',
  TRANSACTION_OP = 'transaction.op',
  TRANSACTION_STATUS = 'transaction.status',
  TYPE = 'type',
  UNREAL_CRASH_TYPE = 'unreal.crash_type',
  USER = 'user',
  USER_DISPLAY = 'user.display',
  USER_EMAIL = 'user.email',
  USER_ID = 'user.id',
  USER_IP = 'user.ip',
  USER_USERNAME = 'user.username',
  USER_SEGMENT = 'user.segment',
  APP_IN_FOREGROUND = 'app.in_foreground',
  FUNCTION_DURATION = 'function.duration',
  OTA_UPDATES_CHANNEL = 'ota_updates.channel',
  OTA_UPDATES_RUNTIME_VERSION = 'ota_updates.runtime_version',
  OTA_UPDATES_UPDATE_ID = 'ota_updates.update_id',
}

type SharedFieldKey =
  | FieldKey.DIST
  | FieldKey.ENVIRONMENT
  | FieldKey.EVENT_TIMESTAMP
  | FieldKey.HAS
  | FieldKey.HTTP_METHOD
  | FieldKey.HTTP_REFERER
  | FieldKey.HTTP_STATUS_CODE
  | FieldKey.HTTP_URL
  | FieldKey.ID
  | FieldKey.MESSAGE
  | FieldKey.PLATFORM
  | FieldKey.PLATFORM_NAME
  | FieldKey.PROFILE_ID
  | FieldKey.PROJECT
  | FieldKey.REPLAY_ID
  | FieldKey.TIMESTAMP
  | FieldKey.TITLE
  | FieldKey.TRACE
  | FieldKey.TRACE_PARENT_SPAN
  | FieldKey.TRACE_SPAN
  | FieldKey.TRANSACTION
  | FieldKey.APP_IN_FOREGROUND;

type ErrorFieldKey =
  | FieldKey.AGE
  | FieldKey.ASSIGNED
  | FieldKey.ASSIGNED_OR_SUGGESTED
  | FieldKey.BOOKMARKS
  | FieldKey.CULPRIT
  | FieldKey.DETECTOR
  | FieldKey.ERROR_HANDLED
  | FieldKey.ERROR_MECHANISM
  | FieldKey.ERROR_TYPE
  | FieldKey.ERROR_UNHANDLED
  | FieldKey.ERROR_VALUE
  | FieldKey.ERROR_RECEIVED
  | FieldKey.ERROR_MAIN_THREAD
  | FieldKey.EVENT_TYPE
  | FieldKey.FIRST_RELEASE
  | FieldKey.FIRST_SEEN
  | FieldKey.IS
  | FieldKey.ISSUE
  | FieldKey.ISSUE_CATEGORY
  | FieldKey.ISSUE_PRIORITY
  | FieldKey.ISSUE_SEER_ACTIONABILITY
  | FieldKey.ISSUE_SEER_LAST_RUN
  | FieldKey.ISSUE_TYPE
  | FieldKey.LAST_SEEN
  | FieldKey.LEVEL
  | FieldKey.LOCATION
  | FieldKey.STACK_ABS_PATH
  | FieldKey.STACK_COLNO
  | FieldKey.STACK_FILENAME
  | FieldKey.STACK_FUNCTION
  | FieldKey.STACK_IN_APP
  | FieldKey.STACK_LINENO
  | FieldKey.STACK_MODULE
  | FieldKey.STACK_PACKAGE
  | FieldKey.STACK_RESOURCE
  | FieldKey.STACK_STACK_LEVEL
  | FieldKey.STATUS
  | FieldKey.SYMBOLICATED_IN_APP
  | FieldKey.TIMES_SEEN
  | FieldKey.TYPE
  | FieldKey.UNREAL_CRASH_TYPE;

type BrowserFieldKey = FieldKey.BROWSER_NAME;

type DeviceFieldKey =
  | FieldKey.DEVICE
  | FieldKey.DEVICE_ARCH
  | FieldKey.DEVICE_BATTERY_LEVEL
  | FieldKey.DEVICE_BRAND
  | FieldKey.DEVICE_CHARGING
  | FieldKey.DEVICE_CLASS
  | FieldKey.DEVICE_FAMILY
  | FieldKey.DEVICE_LOCALE
  | FieldKey.DEVICE_MODEL_ID
  | FieldKey.DEVICE_NAME
  | FieldKey.DEVICE_ONLINE
  | FieldKey.DEVICE_ORIENTATION
  | FieldKey.DEVICE_SCREEN_DENSITY
  | FieldKey.DEVICE_SCREEN_DPI
  | FieldKey.DEVICE_SCREEN_HEIGHT_PIXELS
  | FieldKey.DEVICE_SCREEN_WIDTH_PIXELS
  | FieldKey.DEVICE_SIMULATOR
  | FieldKey.DEVICE_UUID;

type GeoFieldKey =
  | FieldKey.GEO_CITY
  | FieldKey.GEO_COUNTRY_CODE
  | FieldKey.GEO_REGION
  | FieldKey.GEO_SUBDIVISION;

type OsFieldKey =
  | FieldKey.OS
  | FieldKey.OS_BUILD
  | FieldKey.OS_KERNEL_VERSION
  | FieldKey.OS_NAME
  | FieldKey.OS_DISTRIBUTION_NAME
  | FieldKey.OS_DISTRIBUTION_VERSION;

type ReleaseFieldKey =
  | FieldKey.RELEASE
  | FieldKey.RELEASE_BUILD
  | FieldKey.RELEASE_PACKAGE
  | FieldKey.RELEASE_STAGE
  | FieldKey.RELEASE_VERSION;

type SDKFieldKey = FieldKey.SDK_NAME | FieldKey.SDK_VERSION;

type TransactionFieldKey =
  | FieldKey.TIMESTAMP_TO_DAY
  | FieldKey.TIMESTAMP_TO_HOUR
  | FieldKey.TOTAL_COUNT
  | FieldKey.TRACE_CLIENT_SAMPLE_RATE
  | FieldKey.TRANSACTION_DURATION
  | FieldKey.TRANSACTION_OP
  | FieldKey.TRANSACTION_STATUS;

type UserFieldKey =
  | FieldKey.USER
  | FieldKey.USER_DISPLAY
  | FieldKey.USER_EMAIL
  | FieldKey.USER_ID
  | FieldKey.USER_IP
  | FieldKey.USER_USERNAME
  | FieldKey.USER_SEGMENT;

type ProfileFieldKey = FieldKey.FUNCTION_DURATION;

type OTAFieldKey =
  | FieldKey.OTA_UPDATES_CHANNEL
  | FieldKey.OTA_UPDATES_RUNTIME_VERSION
  | FieldKey.OTA_UPDATES_UPDATE_ID;

export enum FieldValueType {
  BOOLEAN = 'boolean',
  DATE = 'date',
  DURATION = 'duration',
  INTEGER = 'integer',
  NUMBER = 'number',
  PERCENTAGE = 'percentage',
  STRING = 'string',
  NEVER = 'never',
  SIZE = 'size',
  SIZE_BASE10 = 'size_base10',
  RATE = 'rate',
  PERCENT_CHANGE = 'percent_change',
  SCORE = 'score',
  CURRENCY = 'currency',
}

export enum WebVital {
  FP = 'measurements.fp',
  FCP = 'measurements.fcp',
  LCP = 'measurements.lcp',
  FID = 'measurements.fid',
  CLS = 'measurements.cls',
  TTFB = 'measurements.ttfb',
  INP = 'measurements.inp',
  REQUEST_TIME = 'measurements.ttfb.requesttime',
}

export enum MobileVital {
  APP_START_COLD = 'measurements.app_start_cold',
  APP_START_WARM = 'measurements.app_start_warm',
  FRAMES_TOTAL = 'measurements.frames_total',
  FRAMES_SLOW = 'measurements.frames_slow',
  FRAMES_FROZEN = 'measurements.frames_frozen',
  FRAMES_SLOW_RATE = 'measurements.frames_slow_rate',
  FRAMES_FROZEN_RATE = 'measurements.frames_frozen_rate',
  STALL_COUNT = 'measurements.stall_count',
  STALL_TOTAL_TIME = 'measurements.stall_total_time',
  STALL_LONGEST_TIME = 'measurements.stall_longest_time',
  STALL_PERCENTAGE = 'measurements.stall_percentage',
  TIME_TO_FULL_DISPLAY = 'measurements.time_to_full_display',
  TIME_TO_INITIAL_DISPLAY = 'measurements.time_to_initial_display',
}

export enum StackTags {
  STACK_ABS_PATH = 'stack.abs_path',
  STACK_COLNO = 'stack.colno',
  STACK_FILENAME = 'stack.filename',
  STACK_FUNCTION = 'stack.function',
  STACK_IN_APP = 'stack.in_app',
  STACK_LINENO = 'stack.lineno',
  STACK_MODULE = 'stack.module',
  STACK_PACKAGE = 'stack.package',
  STACK_RESOURCE = 'stack.resource',
  STACK_STACK_LEVEL = 'stack.stack_level',
}

export enum ErrorTags {
  ERROR_HANDLED = 'error.handled',
  ERROR_MECHANISM = 'error.mechanism',
  ERROR_TYPE = 'error.type',
  ERROR_UNHANDLED = 'error.unhandled',
  ERROR_VALUE = 'error.value',
  ERROR_RECEIVED = 'error.received',
  ERROR_MAIN_THREAD = 'error.main_thread',
}

export enum SpanOpBreakdown {
  SPANS_BROWSER = 'spans.browser',
  SPANS_DB = 'spans.db',
  SPANS_HTTP = 'spans.http',
  SPANS_RESOURCE = 'spans.resource',
  SPANS_UI = 'spans.ui',
}

enum SpanHttpField {
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH = 'http.decoded_response_content_length',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  HTTP_RESPONSE_TRANSFER_SIZE = 'http.response_transfer_size',
}

export enum AggregationKey {
  COUNT = 'count',
  COUNT_UNIQUE = 'count_unique',
  COUNT_MISERABLE = 'count_miserable',
  COUNT_IF = 'count_if',
  COUNT_WEB_VITALS = 'count_web_vitals',
  EPS = 'eps',
  EPM = 'epm',
  SAMPLE_COUNT = 'sample_count',
  SAMPLE_EPS = 'sample_eps',
  SAMPLE_EPM = 'sample_epm',
  FAILURE_COUNT = 'failure_count',
  MIN = 'min',
  MAX = 'max',
  SUM = 'sum',
  ANY = 'any',
  P50 = 'p50',
  P75 = 'p75',
  P90 = 'p90',
  P95 = 'p95',
  P99 = 'p99',
  P100 = 'p100',
  PERCENTILE = 'percentile',
  AVG = 'avg',
  APDEX = 'apdex',
  USER_MISERY = 'user_misery',
  FAILURE_RATE = 'failure_rate',
  LAST_SEEN = 'last_seen',
  PERFORMANCE_SCORE = 'performance_score',
}

export enum IsFieldValues {
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved',
  ARCHIVED = 'archived',
  ESCALATING = 'escalating',
  NEW = 'new',
  ONGOING = 'ongoing',
  REGRESSED = 'regressed',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  FOR_REVIEW = 'for_review',
  LINKED = 'linked',
  UNLINKED = 'unlinked',
}

const IsFieldDescriptions: Record<IsFieldValues, string> = {
  [IsFieldValues.RESOLVED]: t('Issues marked as fixed'),
  [IsFieldValues.UNRESOLVED]: t('Issues still active and needing attention'),
  [IsFieldValues.ARCHIVED]: t('Issues that have been archived'),
  [IsFieldValues.ESCALATING]: t(
    'Issues occurring significantly more often than they used to'
  ),
  [IsFieldValues.NEW]: t('Issues that first occurred in the last 7 days'),
  [IsFieldValues.ONGOING]: t(
    'Issues created more than 7 days ago or manually been marked as reviewed'
  ),
  [IsFieldValues.REGRESSED]: t('Issues resolved then occurred again'),
  [IsFieldValues.ASSIGNED]: t('Issues assigned to a team member'),
  [IsFieldValues.UNASSIGNED]: t('Issues not assigned to anyone'),
  [IsFieldValues.FOR_REVIEW]: t('Issues pending review'),
  [IsFieldValues.LINKED]: t('Issues linked to other issues'),
  [IsFieldValues.UNLINKED]: t('Issues not linked to other issues'),
};

export function getIsFieldDescriptionFromValue(
  isFieldValue: IsFieldValues
): string | undefined {
  if (isFieldValue in IsFieldDescriptions) {
    return IsFieldDescriptions[isFieldValue];
  }
  return undefined;
}

type AggregateColumnParameter = {
  /**
   * The types of columns that are valid for this parameter.
   * Can pass a list of FieldValueTypes or a predicate function.
   */
  columnTypes:
    | FieldValueType[]
    | ((field: {key: string; valueType: FieldValueType}) => boolean);
  kind: 'column';
  name: string;
  required: boolean;
  defaultValue?: string;
};

type AggregateValueParameter = {
  dataType: FieldValueType;
  kind: 'value';
  name: string;
  required: boolean;
  defaultValue?: string;
  options?: Array<{value: string; label?: string}>;
  placeholder?: string;
};

export type AggregateParameter = AggregateColumnParameter | AggregateValueParameter;

type ParameterDependentValueType = (parameters: Array<string | null>) => FieldValueType;

export interface FieldDefinition {
  kind: FieldKind;
  valueType: FieldValueType | null;
  /**
   * Allow all comparison operators to be used with this field.
   * Useful for fields like `release.version` which accepts text, but
   * can also be used with operators like `>=` or `<`.
   */
  allowComparisonOperators?: boolean;
  /**
   * Allow wildcard (*) matching for this field.
   * This is only valid for string fields and will default to true.
   * Note that the `disallowWildcardOperators` setting will override this.
   */
  allowWildcard?: boolean;
  /**
   * Default value for the field
   */
  defaultValue?: string;
  /**
   * Is this field being deprecated
   */
  deprecated?: boolean;
  /**
   * Description of the field
   */
  desc?: string;
  /**
   * Disallow wildcard (contains, starts with, ends with) operators for this field
   * This is only valid for string fields and will default to false.
   * Setting this to true will override `allowWildcard`.
   */
  disallowWildcardOperators?: boolean;
  /**
   * Feature flag that indicates gating of the field from use
   */
  featureFlag?: string;
  /**
   * Additional keywords used when filtering via autocomplete
   */
  keywords?: string[];
  /**
   * Only valid for aggregate fields.
   * Modifies the value type based on the parameters passed to the function.
   */
  parameterDependentValueType?: ParameterDependentValueType;
  /**
   * Only valid for aggregate fields.
   * Defines the number and type of parameters that the function accepts.
   */
  parameters?: AggregateParameter[];
  /**
   * Potential values for the field
   */
  values?: string[];
}

type ColumnValidator = (field: {key: string; valueType: FieldValueType}) => boolean;

function validateForNumericAggregate(
  validColumnTypes: FieldValueType[]
): ColumnValidator {
  return function ({key, valueType}) {
    // these built-in columns cannot be applied to numeric aggregates such as percentile(...)
    if (
      [
        FieldKey.DEVICE_BATTERY_LEVEL,
        FieldKey.STACK_COLNO,
        FieldKey.STACK_LINENO,
        FieldKey.STACK_STACK_LEVEL,
      ].includes(key as FieldKey)
    ) {
      return false;
    }

    return validColumnTypes.includes(valueType);
  };
}

function getDynamicFieldValueType(parameters: Array<string | null>): FieldValueType {
  const column = parameters[0];
  const fieldDef = column ? getFieldDefinition(column) : null;
  return fieldDef?.valueType ?? FieldValueType.NUMBER;
}

function validateAndDenyListColumns(
  validColumnTypes: FieldValueType[],
  deniedColumns: string[]
): ColumnValidator {
  return function ({key, valueType}) {
    return validColumnTypes.includes(valueType) && !deniedColumns.includes(key);
  };
}

function validateAllowedColumns(validColumns: string[]): ColumnValidator {
  return function ({key}): boolean {
    return validColumns.includes(key);
  };
}

export const AGGREGATION_FIELDS: Record<AggregationKey, FieldDefinition> = {
  [AggregationKey.COUNT]: {
    desc: t('count of events'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [],
  },
  [AggregationKey.COUNT_UNIQUE]: {
    desc: t('Unique count of the field values'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.INTEGER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.STRING,
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.DURATION,
          FieldValueType.BOOLEAN,
        ],
        defaultValue: 'user',
        required: true,
      },
    ],
  },
  [AggregationKey.COUNT_MISERABLE]: {
    desc: t('Count of unique miserable users'),
    kind: FieldKind.FUNCTION,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateAllowedColumns(['user']),
        defaultValue: 'user',
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.NUMBER,
        defaultValue: '300',
        required: true,
      },
    ],
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.COUNT_IF]: {
    desc: t('Count of events matching the parameter conditions'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateAndDenyListColumns(
          [
            FieldValueType.STRING,
            FieldValueType.NUMBER,
            FieldValueType.DURATION,
            FieldValueType.INTEGER,
          ],
          ['id', 'issue', 'user.display']
        ),
        defaultValue: 'transaction.duration',
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.STRING,
        defaultValue: CONDITIONS_ARGUMENTS[0]!.value,
        options: CONDITIONS_ARGUMENTS,
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.STRING,
        defaultValue: '300',
        required: true,
      },
    ],
  },
  [AggregationKey.COUNT_WEB_VITALS]: {
    desc: t('Count of web vitals with a specific status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: function ({key}): boolean {
          return [
            WebVital.LCP,
            WebVital.FP,
            WebVital.FCP,
            WebVital.FID,
            WebVital.CLS,
          ].includes(key as WebVital);
        },
        defaultValue: WebVital.LCP,
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        options: WEB_VITALS_QUALITY,
        dataType: FieldValueType.STRING,
        defaultValue: WEB_VITALS_QUALITY[0]!.value,
        required: true,
      },
    ],
  },
  [AggregationKey.EPS]: {
    desc: t('Events per second'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [],
  },
  [AggregationKey.EPM]: {
    desc: t('Events per minute'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [],
  },
  [AggregationKey.SAMPLE_COUNT]: {
    desc: t('Raw sample count'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.INTEGER,
    parameters: [],
  },
  [AggregationKey.SAMPLE_EPS]: {
    desc: t('Raw sample EPS'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [],
  },
  [AggregationKey.SAMPLE_EPM]: {
    desc: t('Raw sample EPM'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [],
  },
  [AggregationKey.FAILURE_RATE]: {
    desc: t('Failed event percentage based on transaction.status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.PERCENTAGE,
    parameters: [],
  },
  [AggregationKey.FAILURE_COUNT]: {
    desc: t('Failed event count based on transaction.status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [],
  },
  [AggregationKey.MIN]: {
    desc: t('Returns the minimum value of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.INTEGER,
          FieldValueType.NUMBER,
          FieldValueType.DURATION,
          FieldValueType.DATE,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.MAX]: {
    desc: t('Returns maximum value of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.INTEGER,
          FieldValueType.NUMBER,
          FieldValueType.DURATION,
          FieldValueType.DATE,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.SUM]: {
    desc: t('Returns the total value for the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        required: true,
        defaultValue: 'transaction.duration',
      },
    ],
  },
  [AggregationKey.ANY]: {
    desc: t('Not Recommended, a random field value'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.STRING,
          FieldValueType.INTEGER,
          FieldValueType.NUMBER,
          FieldValueType.DURATION,
          FieldValueType.DATE,
          FieldValueType.BOOLEAN,
        ],
        required: true,
        defaultValue: 'transaction.duration',
      },
    ],
  },
  [AggregationKey.P50]: {
    desc: t('Returns the 50th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.P75]: {
    desc: t('Returns the 75th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.P90]: {
    desc: t('Returns the 90th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.P95]: {
    desc: t('Returns the 95th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.P99]: {
    desc: t('Returns the 99th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.P100]: {
    desc: t('Returns the 100th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.PERCENTILE]: {
    desc: t('Returns the percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.NUMBER,
        defaultValue: '0.5',
        required: true,
      },
    ],
  },
  [AggregationKey.AVG]: {
    desc: t('Returns averages for a selected field'),
    kind: FieldKind.FUNCTION,
    defaultValue: '300ms',
    valueType: null,
    parameterDependentValueType: getDynamicFieldValueType,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'transaction.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.APDEX]: {
    desc: t('Performance score based on a duration threshold'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.NUMBER,
        defaultValue: '300',
        required: true,
      },
    ],
  },
  [AggregationKey.USER_MISERY]: {
    desc: t(
      'User-weighted performance metric that counts the number of unique users who were frustrated'
    ),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.NUMBER,
        defaultValue: '300',
        required: true,
      },
    ],
  },
  [AggregationKey.LAST_SEEN]: {
    desc: t('Issues last seen at a date and time'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.DATE,
    parameters: [],
  },
  [AggregationKey.PERFORMANCE_SCORE]: {
    desc: t('Returns the performance score for a given web vital'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.SCORE,
    parameters: [
      {
        name: 'value',
        kind: 'column',
        columnTypes: [FieldValueType.NUMBER],
        defaultValue: 'measurements.score.total',
        required: true,
      },
    ],
  },
};

// TODO: Extend the two lists below with more options upon backend support
export const ALLOWED_EXPLORE_VISUALIZE_FIELDS: SpanFields[] = [
  SpanFields.SPAN_DURATION, // DO NOT RE-ORDER: the first element is used as the default
  SpanFields.SPAN_SELF_TIME,
];

export const ALLOWED_EXPLORE_VISUALIZE_AGGREGATES: AggregationKey[] = [
  AggregationKey.COUNT, // DO NOT RE-ORDER: the first element is used as the default
  AggregationKey.AVG,
  AggregationKey.P50,
  AggregationKey.P75,
  AggregationKey.P90,
  AggregationKey.P95,
  AggregationKey.P99,
  AggregationKey.P100,
  AggregationKey.SUM,
  AggregationKey.MIN,
  AggregationKey.MAX,
  AggregationKey.COUNT_UNIQUE,
  AggregationKey.EPM,
  AggregationKey.EPS,
  AggregationKey.FAILURE_RATE,
  AggregationKey.FAILURE_COUNT,
];

export const ALLOWED_EXPLORE_EQUATION_AGGREGATES: AggregationKey[] = [
  ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  AggregationKey.COUNT_IF,
  AggregationKey.APDEX,
  AggregationKey.USER_MISERY,
];

const LOG_AGGREGATION_FIELDS: Record<AggregationKey, FieldDefinition> = {
  ...AGGREGATION_FIELDS,
  [AggregationKey.COUNT]: {
    ...AGGREGATION_FIELDS[AggregationKey.COUNT],
    valueType: FieldValueType.INTEGER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.STRING,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
        ],
        defaultValue: OurLogKnownFieldKey.MESSAGE,
        required: false,
      },
    ],
  },
  [AggregationKey.COUNT_UNIQUE]: {
    ...AGGREGATION_FIELDS[AggregationKey.COUNT_UNIQUE],
    valueType: FieldValueType.INTEGER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [FieldValueType.STRING],
        required: true,
        defaultValue: OurLogKnownFieldKey.MESSAGE,
      },
    ],
  },
  [AggregationKey.SUM]: {
    ...AGGREGATION_FIELDS[AggregationKey.SUM],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.AVG]: {
    ...AGGREGATION_FIELDS[AggregationKey.AVG],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.P50]: {
    ...AGGREGATION_FIELDS[AggregationKey.P50],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.P75]: {
    ...AGGREGATION_FIELDS[AggregationKey.P75],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.P90]: {
    ...AGGREGATION_FIELDS[AggregationKey.P90],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.P95]: {
    ...AGGREGATION_FIELDS[AggregationKey.P95],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.P99]: {
    ...AGGREGATION_FIELDS[AggregationKey.P99],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.MAX]: {
    ...AGGREGATION_FIELDS[AggregationKey.MAX],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
  [AggregationKey.MIN]: {
    ...AGGREGATION_FIELDS[AggregationKey.MIN],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.INTEGER,
          FieldValueType.PERCENTAGE,
          FieldValueType.CURRENCY,
          FieldValueType.SIZE,
        ],
        required: true,
      },
    ],
  },
};

const SPAN_AGGREGATION_FIELDS: Record<AggregationKey, FieldDefinition> = {
  ...AGGREGATION_FIELDS,
  [AggregationKey.COUNT]: {
    ...AGGREGATION_FIELDS[AggregationKey.COUNT],
    valueType: FieldValueType.NUMBER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: function ({key, valueType}) {
          return (
            key === SpanFields.SPAN_DURATION &&
            (valueType === FieldValueType.DURATION || valueType === FieldValueType.NUMBER)
          );
        },
        defaultValue: 'span.duration',
        required: false,
      },
    ],
  },
  [AggregationKey.COUNT_UNIQUE]: {
    ...AGGREGATION_FIELDS[AggregationKey.COUNT_UNIQUE],
    valueType: FieldValueType.INTEGER,
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: [FieldValueType.STRING],
        defaultValue: 'span.op',
        required: true,
      },
    ],
  },
  [AggregationKey.MIN]: {
    ...AGGREGATION_FIELDS[AggregationKey.MIN],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.INTEGER,
          FieldValueType.NUMBER,
          FieldValueType.DURATION,
          FieldValueType.DATE,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.MAX]: {
    ...AGGREGATION_FIELDS[AggregationKey.MAX],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.INTEGER,
          FieldValueType.NUMBER,
          FieldValueType.DURATION,
          FieldValueType.DATE,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.SUM]: {
    ...AGGREGATION_FIELDS[AggregationKey.SUM],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        required: true,
        defaultValue: 'span.duration',
      },
    ],
  },
  [AggregationKey.AVG]: {
    ...AGGREGATION_FIELDS[AggregationKey.AVG],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.P50]: {
    ...AGGREGATION_FIELDS[AggregationKey.P50],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.P75]: {
    ...AGGREGATION_FIELDS[AggregationKey.P75],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.P90]: {
    ...AGGREGATION_FIELDS[AggregationKey.P90],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.P95]: {
    ...AGGREGATION_FIELDS[AggregationKey.P95],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.P99]: {
    ...AGGREGATION_FIELDS[AggregationKey.P99],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.P100]: {
    ...AGGREGATION_FIELDS[AggregationKey.P100],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([
          FieldValueType.DURATION,
          FieldValueType.NUMBER,
          FieldValueType.PERCENTAGE,
        ]),
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  },
  [AggregationKey.COUNT_IF]: {
    ...AGGREGATION_FIELDS[AggregationKey.COUNT_IF],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: () => {
          return true;
        },
        defaultValue: 'span.duration',
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.STRING,
        defaultValue: 'greater',
        options: CONDITIONS_ARGUMENTS,
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.STRING,
        defaultValue: '300',
        required: true,
      },
    ],
  },
  [AggregationKey.APDEX]: {
    ...AGGREGATION_FIELDS[AggregationKey.APDEX],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([FieldValueType.DURATION]),
        defaultValue: 'span.duration',
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.NUMBER,
        defaultValue: '300',
        required: true,
      },
    ],
  },

  [AggregationKey.USER_MISERY]: {
    ...AGGREGATION_FIELDS[AggregationKey.USER_MISERY],
    parameters: [
      {
        name: 'column',
        kind: 'column',
        columnTypes: validateForNumericAggregate([FieldValueType.DURATION]),
        defaultValue: 'span.duration',
        required: true,
      },
      {
        name: 'value',
        kind: 'value',
        dataType: FieldValueType.NUMBER,
        defaultValue: '300',
        required: true,
      },
    ],
  },
};

export const NO_ARGUMENT_SPAN_AGGREGATES: AggregationKey[] = Object.entries(
  SPAN_AGGREGATION_FIELDS
)
  .filter(([_, field]) => field.parameters?.length === 0)
  .map(([key]) => key as AggregationKey);

export const MEASUREMENT_FIELDS: Record<WebVital | MobileVital, FieldDefinition> = {
  [WebVital.FP]: {
    desc: t('Web Vital First Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [WebVital.FCP]: {
    desc: t('Web Vital First Contentful Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [WebVital.LCP]: {
    desc: t('Web Vital Largest Contentful Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [WebVital.FID]: {
    desc: t('Web Vital First Input Delay'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [WebVital.CLS]: {
    desc: t('Web Vital Cumulative Layout Shift'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.NUMBER,
  },
  [WebVital.TTFB]: {
    desc: t('Web Vital Time To First Byte'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [WebVital.REQUEST_TIME]: {
    desc: t('Time between start of request to start of response'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.APP_START_COLD]: {
    desc: t('First launch (not in memory and no process exists)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.APP_START_WARM]: {
    desc: t('Already launched (partial memory and process may exist)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.FRAMES_TOTAL]: {
    desc: t('Total number of frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.FRAMES_SLOW]: {
    desc: t('Number of slow frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.FRAMES_FROZEN]: {
    desc: t('Number of frozen frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.FRAMES_SLOW_RATE]: {
    desc: t('Number of slow frames out of the total'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
  [MobileVital.FRAMES_FROZEN_RATE]: {
    desc: t('Number of frozen frames out of the total'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
  [MobileVital.STALL_COUNT]: {
    desc: t('Count of slow Javascript event loops (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.STALL_TOTAL_TIME]: {
    desc: t('Total stall duration (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.STALL_LONGEST_TIME]: {
    desc: t('Duration of slowest Javascript event loop (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.STALL_PERCENTAGE]: {
    desc: t('Total stall duration out of the total transaction duration (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
  [MobileVital.TIME_TO_FULL_DISPLAY]: {
    desc: t(
      'The time between application launch and complete display of all resources and views'
    ),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.TIME_TO_INITIAL_DISPLAY]: {
    desc: t('The time it takes for an application to produce its first frame'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [WebVital.INP]: {
    desc: t('Web Vital Interaction to Next Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
};

const SPAN_OP_FIELDS: Record<SpanOpBreakdown, FieldDefinition> = {
  [SpanOpBreakdown.SPANS_BROWSER]: {
    desc: t('Cumulative time based on the browser operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SPANS_DB]: {
    desc: t('Cumulative time based on the database operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SPANS_HTTP]: {
    desc: t('Cumulative time based on the http operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SPANS_RESOURCE]: {
    desc: t('Cumulative time based on the resource operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SPANS_UI]: {
    desc: t('Cumulative time based on the ui operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
};

type TraceFields =
  | SpanFields.IS_TRANSACTION
  | SpanFields.SPAN_ACTION
  | SpanFields.SPAN_DESCRIPTION
  | SpanFields.SPAN_DOMAIN
  | SpanFields.SPAN_DURATION
  | SpanFields.SPAN_GROUP
  | SpanFields.SPAN_CATEGORY
  | SpanFields.SPAN_OP
  | SpanFields.NORMALIZED_DESCRIPTION
  // TODO: Remove self time field when it is deprecated
  | SpanFields.SPAN_SELF_TIME
  | SpanFields.SPAN_STATUS
  | SpanFields.SPAN_STATUS_CODE
  | SpanFields.CACHE_HIT;

const TRACE_FIELD_DEFINITIONS: Record<TraceFields, FieldDefinition> = {
  /** Indexed Fields */
  [SpanFields.SPAN_ACTION]: {
    desc: t(
      'The Sentry Insights span action, e.g `SELECT` for a SQL span or `POST` for an HTTP client span'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_DESCRIPTION]: {
    desc: t('Description of the span’s operation'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.NORMALIZED_DESCRIPTION]: {
    desc: t(
      'Parameterized and normalized description of the span, commonly used for grouping within insights'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_DOMAIN]: {
    desc: t(
      'General scope of the span’s action, i.e. the tables involved in a `db` span or the host name in an `http` span'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_DURATION]: {
    desc: t('The total time taken by the span'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanFields.SPAN_GROUP]: {
    desc: t('Unique hash of the span’s description'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_CATEGORY]: {
    desc: t(
      'The prefix of the span operation, e.g if `span.op` is `http.client`, then `span.category` is `http`'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_OP]: {
    desc: t('The operation of the span, e.g `http.client`, `middleware`'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_SELF_TIME]: {
    desc: t('The duration of the span excluding the duration of its child spans'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanFields.SPAN_STATUS]: {
    desc: t('Status of the operation the span represents'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_STATUS_CODE]: {
    desc: t('The HTTP response status code'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.IS_TRANSACTION]: {
    desc: t('The span is also a transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [SpanFields.CACHE_HIT]: {
    desc: t('`true` if the  cache was hit, `false` otherwise'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
};

const SHARED_FIELD_KEY: Record<SharedFieldKey, FieldDefinition> = {
  [FieldKey.DIST]: {
    desc: t(
      'Distinguishes between build or deployment variants of the same release of an application.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ENVIRONMENT]: {
    desc: t('The environment the event was seen in'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.EVENT_TIMESTAMP]: {
    desc: t('Date and time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.HTTP_METHOD]: {
    desc: t('Method of the request that created the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_REFERER]: {
    desc: t('The web page the resource was requested from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_STATUS_CODE]: {
    desc: t('Type of response (i.e., 200, 404)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_URL]: {
    desc: t('Full URL of the request without parameters'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ID]: {
    desc: t('The event identification number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.MESSAGE]: {
    desc: t('Error message or transaction name'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.PLATFORM]: {
    desc: t('Name of the platform'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.PLATFORM_NAME]: {
    desc: t('Name of the platform'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.PROFILE_ID]: {
    desc: t('The ID of an associated profile'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.PROJECT]: {kind: FieldKind.FIELD, valueType: FieldValueType.STRING},
  [FieldKey.HAS]: {
    desc: t('Determines if a tag or field exists in an event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.REPLAY_ID]: {
    desc: t('The ID of an associated Session Replay'),
    kind: FieldKind.TAG,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.TIMESTAMP]: {
    desc: t('The time an event finishes'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.TITLE]: {
    desc: t('Error or transaction name identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE]: {
    desc: t('The trace identification number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.TRACE_PARENT_SPAN]: {
    desc: t('Span identification number of the parent to the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.TRACE_SPAN]: {
    desc: t('Span identification number of the root span'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.TRANSACTION]: {
    desc: t('Error or transaction name identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.APP_IN_FOREGROUND]: {
    desc: t('Indicates if the app is in the foreground or background'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
};

const ERROR_FIELD_DEFINITION: Record<ErrorFieldKey, FieldDefinition> = {
  [FieldKey.AGE]: {
    desc: t('The age of the issue in relative time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.ASSIGNED]: {
    desc: t('Assignee of the issue as a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.ASSIGNED_OR_SUGGESTED]: {
    desc: t('Assignee or suggestee of the issue as a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.BOOKMARKS]: {
    desc: t('The issues bookmarked by a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.CULPRIT]: {
    deprecated: true,
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DETECTOR]: {
    desc: t('The detector that triggered the issue'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.ERROR_HANDLED]: {
    desc: t('Determines handling status of the error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.ERROR_MECHANISM]: {
    desc: t('The mechanism that created the error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ERROR_TYPE]: {
    desc: t('The type of exception'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ERROR_UNHANDLED]: {
    desc: t('Determines unhandling status of the error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.ERROR_VALUE]: {
    desc: t('Original value that exhibits error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ERROR_RECEIVED]: {
    desc: t('The datetime that the error was received'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.ERROR_MAIN_THREAD]: {
    desc: t('Indicates if the error occurred on the main thread'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.EVENT_TYPE]: {
    desc: t('Type of event (Errors, transactions, csp and default)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.FIRST_RELEASE]: {
    desc: t('Issues first seen in a given release'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.FIRST_SEEN]: {
    desc: t('Issues first seen at a given time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.IS]: {
    desc: t('The properties of an issue (i.e. Resolved, unresolved)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    defaultValue: 'unresolved',
    allowWildcard: false,
    values: Object.values(IsFieldValues),
  },
  [FieldKey.ISSUE]: {
    desc: t('The issue identification short code'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.ISSUE_CATEGORY]: {
    desc: t('Category of issue (error or performance)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.ISSUE_PRIORITY]: {
    desc: t('The priority of the issue'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.ISSUE_SEER_ACTIONABILITY]: {
    desc: t('How easily you can fix the issue with a code change, estimated by Seer'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.ISSUE_SEER_LAST_RUN]: {
    desc: t('The last time Seer attempted to auto-fix the issue'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
    allowWildcard: false,
  },
  [FieldKey.ISSUE_TYPE]: {
    desc: t('Type of problem the issue represents (i.e. N+1 Query)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.LAST_SEEN]: {
    desc: t('Issues last seen at a given time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.LEVEL]: {
    kind: FieldKind.FIELD,
    desc: t('Severity of the event (i.e., fatal, error, warning)'),
    valueType: FieldValueType.STRING,
  },
  [FieldKey.LOCATION]: {
    desc: t('Location of error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_ABS_PATH]: {
    desc: t('Absolute path to the source file'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_COLNO]: {
    desc: t('Column number of the call starting at 1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
  },
  [FieldKey.STACK_FILENAME]: {
    desc: t('Relative path to the source file from the root directory'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_FUNCTION]: {
    desc: t('Name of function being called'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_IN_APP]: {
    desc: t('Indicates if frame is related to relevant code in stack trace'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.STACK_LINENO]: {
    desc: t('Line number of the call starting at 1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
  },
  [FieldKey.STACK_MODULE]: {
    desc: t('Platform specific module path'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_PACKAGE]: {
    desc: t('The package the frame is from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_RESOURCE]: {
    desc: t('The package the frame is from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_STACK_LEVEL]: {
    desc: t('Number of frames per stacktrace'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
  },
  [FieldKey.SYMBOLICATED_IN_APP]: {
    desc: t('Indicates if all in-app frames are symbolicated'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.STATUS]: {
    desc: t('Status of the issue'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.TIMES_SEEN]: {
    desc: t('Total number of events'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
    keywords: ['count'],
  },
  [FieldKey.TYPE]: {
    desc: t('Type of event (Errors, transactions, csp and default)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.UNREAL_CRASH_TYPE]: {
    desc: t('Crash type of an Unreal event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const BROWSER_FIELD_DEFINITION: Record<BrowserFieldKey, FieldDefinition> = {
  [FieldKey.BROWSER_NAME]: {
    desc: t('Name of the browser'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const DEVICE_FIELD_DEFINITION: Record<DeviceFieldKey, FieldDefinition> = {
  [FieldKey.DEVICE]: {
    desc: t('The device that the event was seen on'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_ARCH]: {
    desc: t('CPU architecture'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_BATTERY_LEVEL]: {
    desc: t('Indicates remaining battery life'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_BRAND]: {
    desc: t('Brand of device'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_CHARGING]: {
    desc: t('Charging at the time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_CLASS]: {
    desc: t('The estimated performance level of the device, graded low, medium, or high'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.DEVICE_FAMILY]: {
    desc: t('Model name across generations'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_LOCALE]: {
    desc: t("The locale of the user's device"),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_MODEL_ID]: {
    desc: t('Internal hardware revision'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_NAME]: {
    desc: t('Model name as advertised on the market'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_ONLINE]: {
    desc: t('Online at the time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_ORIENTATION]: {
    desc: t('Portrait or landscape view '),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_SCREEN_DENSITY]: {
    desc: t('Pixel density of the device screen'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_SCREEN_DPI]: {
    desc: t('Dots per inch of the device screen'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_SCREEN_HEIGHT_PIXELS]: {
    desc: t('Height of the device screen in pixels'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_SCREEN_WIDTH_PIXELS]: {
    desc: t('Width of the device screen in pixels'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_SIMULATOR]: {
    desc: t('Indicates if it occurred on a simulator'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_UUID]: {
    desc: t('Unique device identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const GEO_FIELD_DEFINITIONS: Record<GeoFieldKey, FieldDefinition> = {
  [FieldKey.GEO_CITY]: {
    desc: t('Full name of the city'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.GEO_COUNTRY_CODE]: {
    desc: t('Country code based on ISO 3166-1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.GEO_REGION]: {
    desc: t('Full name of the country'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.GEO_SUBDIVISION]: {
    desc: t('Full name of the subdivision'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const OS_FIELD_DEFINITIONS: Record<OsFieldKey, FieldDefinition> = {
  [FieldKey.OS]: {
    desc: t('Build and kernel version'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_BUILD]: {
    desc: t('Name of the build'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_DISTRIBUTION_NAME]: {
    desc: t('Distribution name'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_DISTRIBUTION_VERSION]: {
    desc: t('Distribution version number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_KERNEL_VERSION]: {
    desc: t('Version number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_NAME]: {
    desc: t('Name of the Operating System'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const RELEASE_FIELD_DEFINITION: Record<ReleaseFieldKey, FieldDefinition> = {
  [FieldKey.RELEASE]: {
    desc: t('The version of your code deployed to an environment'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [FieldKey.RELEASE_BUILD]: {
    desc: t('The full version number that identifies the iteration'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowComparisonOperators: true,
    allowWildcard: false,
  },
  [FieldKey.RELEASE_PACKAGE]: {
    desc: t('The identifier unique to the project or application'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowComparisonOperators: true,
    allowWildcard: false,
  },
  [FieldKey.RELEASE_STAGE]: {
    desc: t('Stage of usage (i.e., adopted, replaced, low)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowComparisonOperators: true,
    allowWildcard: false,
  },
  [FieldKey.RELEASE_VERSION]: {
    desc: t('An abbreviated version number of the build'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowComparisonOperators: true,
    disallowWildcardOperators: true,
  },
};

const SDK_FIELD_DEFINITIONS: Record<SDKFieldKey, FieldDefinition> = {
  [FieldKey.SDK_NAME]: {
    desc: t('Name of the platform that sent the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.SDK_VERSION]: {
    desc: t('Version of the platform that sent the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const TRANSACTION_FIELD_DEFINITIONS: Record<TransactionFieldKey, FieldDefinition> = {
  [FieldKey.TIMESTAMP_TO_HOUR]: {
    desc: t('Rounded down to the nearest hour'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.TIMESTAMP_TO_DAY]: {
    desc: t('Rounded down to the nearest day'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.TOTAL_COUNT]: {
    desc: t('The total number of events for the current query'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
  },
  [FieldKey.TRACE_CLIENT_SAMPLE_RATE]: {
    desc: t('Sample rate of the trace in the SDK between 0 and 1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_DURATION]: {
    desc: t('Duration of the transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION,
  },
  [FieldKey.TRANSACTION_OP]: {
    desc: t('Short code identifying the type of operation the span is measuring'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_STATUS]: {
    desc: t('Describes the status of the span/transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const USER_FIELD_DEFINITIONS: Record<UserFieldKey, FieldDefinition> = {
  [FieldKey.USER]: {
    desc: t('User identification value'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_DISPLAY]: {
    desc: t('The first user field available of email, username, ID, and IP'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_EMAIL]: {
    desc: t('Email address of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_ID]: {
    desc: t('Application specific internal identifier of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_IP]: {
    desc: t('IP Address of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_USERNAME]: {
    desc: t('Username of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_SEGMENT]: {
    desc: t('Segment of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const PROFILE_FIELD_DEFINITIONS: Record<ProfileFieldKey, FieldDefinition> = {
  [FieldKey.FUNCTION_DURATION]: {
    desc: t('Duration of the function'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION,
  },
};

const OTA_FIELD_DEFINITIONS: Record<OTAFieldKey, FieldDefinition> = {
  [FieldKey.OTA_UPDATES_CHANNEL]: {
    desc: t('The channel name of the build from EAS Update'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OTA_UPDATES_RUNTIME_VERSION]: {
    desc: t('The runtime version of the current build from EAS Update'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OTA_UPDATES_UPDATE_ID]: {
    desc: t('The UUID that uniquely identifies the update.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

type AllEventFieldKeys =
  | keyof typeof AGGREGATION_FIELDS
  | keyof typeof MEASUREMENT_FIELDS
  | keyof typeof SPAN_OP_FIELDS
  | keyof typeof TRACE_FIELD_DEFINITIONS
  | FieldKey;

const EVENT_FIELD_DEFINITIONS: Record<AllEventFieldKeys, FieldDefinition> = {
  ...AGGREGATION_FIELDS,
  ...MEASUREMENT_FIELDS,
  ...SPAN_OP_FIELDS,
  ...TRACE_FIELD_DEFINITIONS,
  ...SHARED_FIELD_KEY,
  ...ERROR_FIELD_DEFINITION,
  ...BROWSER_FIELD_DEFINITION,
  ...DEVICE_FIELD_DEFINITION,
  ...GEO_FIELD_DEFINITIONS,
  ...OS_FIELD_DEFINITIONS,
  ...RELEASE_FIELD_DEFINITION,
  ...SDK_FIELD_DEFINITIONS,
  ...TRANSACTION_FIELD_DEFINITIONS,
  ...USER_FIELD_DEFINITIONS,
  ...PROFILE_FIELD_DEFINITIONS,
  ...OTA_FIELD_DEFINITIONS,
};

const SPAN_HTTP_FIELD_DEFINITIONS: Record<SpanHttpField, FieldDefinition> = {
  [SpanHttpField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH]: {
    desc: t('Content length of the decoded response'),
    kind: FieldKind.MEASUREMENT,
    valueType: FieldValueType.SIZE,
  },
  [SpanHttpField.HTTP_RESPONSE_CONTENT_LENGTH]: {
    desc: t('Content length of the response'),
    kind: FieldKind.MEASUREMENT,
    valueType: FieldValueType.SIZE,
  },
  [SpanHttpField.HTTP_RESPONSE_TRANSFER_SIZE]: {
    desc: t('Transfer size of the response'),
    kind: FieldKind.MEASUREMENT,
    valueType: FieldValueType.SIZE,
  },
};

const SPAN_FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  ...EVENT_FIELD_DEFINITIONS,
  ...SPAN_AGGREGATION_FIELDS,
  ...SPAN_HTTP_FIELD_DEFINITIONS,
  [SpanFields.NAME]: {
    desc: t(
      'The span name. A short, human-readable identifier for the operation being performed by the span.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.KIND]: {
    desc: t(
      'The kind of span. Indicates the type of span such as server, client, internal, producer, or consumer.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.SPAN_STATUS]: {
    desc: t('Span status. Indicates whether the span operation was successful.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [SpanFields.STATUS_MESSAGE]: {
    desc: t(
      'Span status message. If the span operation was not successful, this contains an error message.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const LOG_FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  ...LOG_AGGREGATION_FIELDS,
  ...EVENT_FIELD_DEFINITIONS,
  [OurLogKnownFieldKey.CODE_FILE_PATH]: {
    desc: t(
      'The source code file name that identifies the code unit as uniquely as possible (preferably an absolute file path).'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [OurLogKnownFieldKey.CODE_LINE_NUMBER]: {
    desc: t(
      'The line number in %s best representing the operation. It SHOULD point within the code unit named in %s.',
      OurLogKnownFieldKey.CODE_FILE_PATH,
      OurLogKnownFieldKey.CODE_FUNCTION_NAME
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
  },
  [OurLogKnownFieldKey.CODE_FUNCTION_NAME]: {
    desc: t(
      'The method or function name, or equivalent (usually rightmost part of the code unit’s name).'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [OurLogKnownFieldKey.LOGGER]: {
    desc: t('The name of the logger that generated this event.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [OurLogKnownFieldKey.MESSAGE]: {
    desc: t('Log message'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [OurLogKnownFieldKey.PARENT_SPAN_ID]: {
    desc: t(
      'The span id of the span that was active when the log was collected. This should not be set if there was no active span.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [OurLogKnownFieldKey.PAYLOAD_SIZE]: {
    desc: t('The size of the log payload in bytes.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.SIZE,
  },
  [OurLogKnownFieldKey.REPLAY_ID]: {
    desc: t('The ID of an associated sentry replay.'),
    kind: FieldKind.TAG,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [OurLogKnownFieldKey.SERVER_ADDRESS]: {
    desc: t(
      'Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [OurLogKnownFieldKey.SEVERITY]: {
    desc: t('The severity level of the log.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [OurLogKnownFieldKey.SPAN_ID]: {
    desc: t('The associated span ID of the log.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [OurLogKnownFieldKey.TEMPLATE]: {
    desc: t('The parameterized template string.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const TRACEMETRIC_FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  // TODO: Add field definitions for tracemetric fields
};

export const ISSUE_PROPERTY_FIELDS: FieldKey[] = [
  FieldKey.AGE,
  FieldKey.ASSIGNED_OR_SUGGESTED,
  FieldKey.ASSIGNED,
  FieldKey.BOOKMARKS,
  FieldKey.DETECTOR,
  FieldKey.FIRST_RELEASE,
  FieldKey.FIRST_SEEN,
  FieldKey.HAS,
  FieldKey.IS,
  FieldKey.ISSUE_CATEGORY,
  FieldKey.ISSUE_PRIORITY,
  FieldKey.ISSUE_SEER_ACTIONABILITY,
  FieldKey.ISSUE_SEER_LAST_RUN,
  FieldKey.ISSUE_TYPE,
  FieldKey.ISSUE,
  FieldKey.LAST_SEEN,
  FieldKey.RELEASE_STAGE,
  FieldKey.TIMES_SEEN,
];

// Should match Snuba columns defined in sentry/snuba/events.py
export const ISSUE_EVENT_PROPERTY_FIELDS: FieldKey[] = [
  FieldKey.APP_IN_FOREGROUND,
  FieldKey.DEVICE_ARCH,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_CLASS,
  FieldKey.DEVICE_FAMILY,
  FieldKey.DEVICE_LOCALE,
  FieldKey.DEVICE_MODEL_ID,
  FieldKey.DEVICE_NAME,
  FieldKey.DEVICE_ORIENTATION,
  FieldKey.DEVICE_UUID,
  FieldKey.DIST,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_MAIN_THREAD,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_VALUE,
  FieldKey.EVENT_TIMESTAMP,
  FieldKey.EVENT_TYPE,
  FieldKey.GEO_CITY,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.GEO_REGION,
  FieldKey.GEO_SUBDIVISION,
  FieldKey.HTTP_METHOD,
  FieldKey.HTTP_REFERER,
  FieldKey.HTTP_STATUS_CODE,
  FieldKey.HTTP_URL,
  FieldKey.ID,
  FieldKey.LOCATION,
  FieldKey.MESSAGE,
  FieldKey.OS_BUILD,
  FieldKey.OS_KERNEL_VERSION,
  FieldKey.OS_DISTRIBUTION_NAME,
  FieldKey.OS_DISTRIBUTION_VERSION,
  FieldKey.PLATFORM_NAME,
  FieldKey.RELEASE_BUILD,
  FieldKey.RELEASE_PACKAGE,
  FieldKey.RELEASE_VERSION,
  FieldKey.RELEASE,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  FieldKey.STACK_ABS_PATH,
  FieldKey.STACK_FILENAME,
  FieldKey.STACK_FUNCTION,
  FieldKey.STACK_MODULE,
  FieldKey.STACK_PACKAGE,
  FieldKey.STACK_STACK_LEVEL,
  FieldKey.SYMBOLICATED_IN_APP,
  FieldKey.TIMESTAMP,
  FieldKey.TITLE,
  FieldKey.TRACE,
  FieldKey.TRANSACTION,
  FieldKey.UNREAL_CRASH_TYPE,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  FieldKey.USER_IP,
  FieldKey.USER_USERNAME,
  FieldKey.OTA_UPDATES_CHANNEL,
  FieldKey.OTA_UPDATES_RUNTIME_VERSION,
  FieldKey.OTA_UPDATES_UPDATE_ID,
];

export const ISSUE_FIELDS: FieldKey[] = [
  ...ISSUE_PROPERTY_FIELDS,
  ...ISSUE_EVENT_PROPERTY_FIELDS,
];

/**
 * These are valid filter keys in the issue search which are aliases for
 * values in the event context. In cases where a user provides custom event
 * tags with the same name, these may conflict and `tags[name]` should be
 * used instead.
 *
 * Search locations are defined in sentry/snuba/events.py, anything that
 * references a tag should not be defined here.
 */
export const ISSUE_EVENT_FIELDS_THAT_MAY_CONFLICT_WITH_TAGS: Set<FieldKey> = new Set([
  FieldKey.APP_IN_FOREGROUND,
  FieldKey.DEVICE_ARCH,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_CLASS,
  FieldKey.DEVICE_LOCALE,
  FieldKey.DEVICE_MODEL_ID,
  FieldKey.DEVICE_NAME,
  FieldKey.DEVICE_ORIENTATION,
  FieldKey.DEVICE_UUID,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_MAIN_THREAD,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_VALUE,
  FieldKey.EVENT_TIMESTAMP,
  FieldKey.EVENT_TYPE,
  FieldKey.GEO_CITY,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.GEO_REGION,
  FieldKey.GEO_SUBDIVISION,
  FieldKey.HTTP_METHOD,
  FieldKey.HTTP_REFERER,
  FieldKey.HTTP_URL,
  FieldKey.ID,
  FieldKey.LOCATION,
  FieldKey.MESSAGE,
  FieldKey.OS_BUILD,
  FieldKey.OS_KERNEL_VERSION,
  FieldKey.OS_DISTRIBUTION_NAME,
  FieldKey.OS_DISTRIBUTION_VERSION,
  FieldKey.PLATFORM_NAME,
  FieldKey.RELEASE_BUILD,
  FieldKey.RELEASE_PACKAGE,
  FieldKey.RELEASE_VERSION,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  FieldKey.STACK_ABS_PATH,
  FieldKey.STACK_FILENAME,
  FieldKey.STACK_FUNCTION,
  FieldKey.STACK_MODULE,
  FieldKey.STACK_PACKAGE,
  FieldKey.STACK_STACK_LEVEL,
  FieldKey.STATUS,
  FieldKey.TIMESTAMP,
  FieldKey.TITLE,
  FieldKey.TRACE,
  FieldKey.UNREAL_CRASH_TYPE,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  FieldKey.USER_IP,
  FieldKey.USER_USERNAME,
  FieldKey.OTA_UPDATES_CHANNEL,
  FieldKey.OTA_UPDATES_RUNTIME_VERSION,
  FieldKey.OTA_UPDATES_UPDATE_ID,
]);

/**
 * Refer to src/sentry/snuba/events.py, search for Columns
 */
export const DISCOVER_FIELDS = [
  FieldKey.ID,
  // issue.id and project.id are omitted on purpose.
  // Customers should use `issue` and `project` instead.
  FieldKey.TIMESTAMP,
  // time is omitted on purpose.
  // Customers should use `timestamp` or `timestamp.to_hour`.
  FieldKey.TIMESTAMP_TO_HOUR,
  FieldKey.TIMESTAMP_TO_DAY,

  FieldKey.CULPRIT,
  FieldKey.LOCATION,
  FieldKey.MESSAGE,
  FieldKey.PLATFORM,
  FieldKey.PLATFORM_NAME,
  FieldKey.ENVIRONMENT,
  FieldKey.RELEASE,
  FieldKey.DIST,
  FieldKey.TITLE,
  FieldKey.EVENT_TYPE,
  // tags.key and tags.value are omitted on purpose as well.

  FieldKey.TRANSACTION,
  FieldKey.UNREAL_CRASH_TYPE,
  FieldKey.USER,
  FieldKey.USER_ID,
  FieldKey.USER_EMAIL,
  FieldKey.USER_USERNAME,
  FieldKey.USER_IP,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  FieldKey.HTTP_METHOD,
  FieldKey.HTTP_REFERER,
  FieldKey.HTTP_STATUS_CODE,
  FieldKey.HTTP_URL,
  FieldKey.OS_BUILD,
  FieldKey.OS_KERNEL_VERSION,
  FieldKey.OS_DISTRIBUTION_NAME,
  FieldKey.OS_DISTRIBUTION_VERSION,
  FieldKey.DEVICE_NAME,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_LOCALE,
  FieldKey.DEVICE_UUID,
  FieldKey.DEVICE_ARCH,
  FieldKey.DEVICE_FAMILY,
  FieldKey.DEVICE_BATTERY_LEVEL,
  FieldKey.DEVICE_ORIENTATION,
  FieldKey.DEVICE_SCREEN_DENSITY,
  FieldKey.DEVICE_SCREEN_DPI,
  FieldKey.DEVICE_SCREEN_HEIGHT_PIXELS,
  FieldKey.DEVICE_SCREEN_WIDTH_PIXELS,
  FieldKey.DEVICE_SIMULATOR,
  FieldKey.DEVICE_ONLINE,
  FieldKey.DEVICE_CHARGING,
  FieldKey.DEVICE_CLASS,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.GEO_REGION,
  FieldKey.GEO_CITY,
  FieldKey.GEO_SUBDIVISION,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_VALUE,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_RECEIVED,
  FieldKey.ERROR_MAIN_THREAD,
  FieldKey.LEVEL,
  FieldKey.STACK_ABS_PATH,
  FieldKey.STACK_FILENAME,
  FieldKey.STACK_PACKAGE,
  FieldKey.STACK_MODULE,
  FieldKey.STACK_FUNCTION,
  FieldKey.STACK_IN_APP,
  FieldKey.STACK_COLNO,
  FieldKey.STACK_LINENO,
  FieldKey.STACK_STACK_LEVEL,
  FieldKey.SYMBOLICATED_IN_APP,
  // contexts.key and contexts.value omitted on purpose.

  // App context fields
  FieldKey.APP_IN_FOREGROUND,

  // Transaction event fields.
  FieldKey.TRANSACTION_DURATION,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,

  FieldKey.TRACE,
  FieldKey.TRACE_SPAN,
  FieldKey.TRACE_PARENT_SPAN,
  FieldKey.TRACE_CLIENT_SAMPLE_RATE,

  FieldKey.PROFILE_ID,

  // Meta field that returns total count, usually for equations
  FieldKey.TOTAL_COUNT,

  // Field aliases defined in src/sentry/api/event_search.py
  FieldKey.PROJECT,
  FieldKey.ISSUE,
  FieldKey.USER_DISPLAY,

  // Span Op fields
  SpanOpBreakdown.SPANS_BROWSER,
  SpanOpBreakdown.SPANS_DB,
  SpanOpBreakdown.SPANS_HTTP,
  SpanOpBreakdown.SPANS_RESOURCE,
  SpanOpBreakdown.SPANS_UI,

  // Expo Updates fields
  FieldKey.OTA_UPDATES_CHANNEL,
  FieldKey.OTA_UPDATES_RUNTIME_VERSION,
  FieldKey.OTA_UPDATES_UPDATE_ID,
];

export enum ReplayFieldKey {
  ACTIVITY = 'activity',
  BROWSER_NAME = 'browser.name',
  BROWSER_VERSION = 'browser.version',
  COUNT_DEAD_CLICKS = 'count_dead_clicks',
  COUNT_ERRORS = 'count_errors',
  COUNT_INFOS = 'count_infos',
  COUNT_RAGE_CLICKS = 'count_rage_clicks',
  COUNT_SCREENS = 'count_screens',
  COUNT_SEGMENTS = 'count_segments',
  COUNT_TRACES = 'count_traces',
  COUNT_URLS = 'count_urls',
  COUNT_WARNINGS = 'count_warnings',
  DURATION = 'duration',
  ERROR_IDS = 'error_ids',
  IS_ARCHIVED = 'is_archived',
  OS_NAME = 'os.name',
  OS_VERSION = 'os.version',
  REPLAY_TYPE = 'replay_type',
  SCREEN = 'screen',
  SCREENS = 'screens',
  SEEN_BY_ME = 'seen_by_me',
  URLS = 'urls',
  URL = 'url',
  USER_GEO_CITY = 'user.geo.city',
  USER_GEO_COUNTRY_CODE = 'user.geo.country_code',
  USER_GEO_REGION = 'user.geo.region',
  USER_GEO_SUBDIVISION = 'user.geo.subdivision',
  VIEWED_BY_ME = 'viewed_by_me',
}

export enum ReplayClickFieldKey {
  CLICK_ALT = 'click.alt',
  CLICK_CLASS = 'click.class',
  CLICK_ID = 'click.id',
  CLICK_LABEL = 'click.label',
  CLICK_ROLE = 'click.role',
  CLICK_SELECTOR = 'click.selector',
  DEAD_SELECTOR = 'dead.selector',
  RAGE_SELECTOR = 'rage.selector',
  CLICK_TAG = 'click.tag',
  CLICK_TESTID = 'click.testid',
  CLICK_TEXT_CONTENT = 'click.textContent',
  CLICK_TITLE = 'click.title',
  CLICK_COMPONENT_NAME = 'click.component_name',
}

enum ReplayTapFieldKey {
  TAP_MESSAGE = 'tap.message',
  TAP_VIEW_ID = 'tap.view_id',
  TAP_VIEW_CLASS = 'tap.view_class',
}

/**
 * Some fields inside the ReplayRecord type are intentionally omitted:
 * `environment` -> Not backend support, omitted because we have a dropdown for it
 * `finishedAt` -> No backend support, omitted because we StartDate dropdown and duration field support
 * `startedAt` -> No backend support, Omitted because we have StartDate dropdown
 * `longestTransaction` -> value is always zero
 * `title` -> value is always the empty string
 */
export const REPLAY_FIELDS = [
  ReplayFieldKey.ACTIVITY,
  ReplayFieldKey.BROWSER_NAME,
  ReplayFieldKey.BROWSER_VERSION,
  ReplayFieldKey.COUNT_DEAD_CLICKS,
  ReplayFieldKey.COUNT_ERRORS,
  ReplayFieldKey.COUNT_INFOS,
  ReplayFieldKey.COUNT_RAGE_CLICKS,
  ReplayFieldKey.COUNT_SCREENS,
  ReplayFieldKey.COUNT_SEGMENTS,
  ReplayFieldKey.COUNT_TRACES,
  ReplayFieldKey.COUNT_URLS,
  ReplayFieldKey.COUNT_WARNINGS,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_FAMILY,
  FieldKey.DEVICE_MODEL_ID,
  FieldKey.DEVICE_NAME,
  FieldKey.DIST,
  ReplayFieldKey.DURATION,
  ReplayFieldKey.ERROR_IDS,
  FieldKey.ID,
  ReplayFieldKey.IS_ARCHIVED,
  ReplayFieldKey.OS_NAME,
  ReplayFieldKey.OS_VERSION,
  FieldKey.PLATFORM,
  FieldKey.RELEASE,
  ReplayFieldKey.REPLAY_TYPE,
  ReplayFieldKey.SCREEN,
  ReplayFieldKey.SCREENS,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  ReplayFieldKey.SEEN_BY_ME,
  FieldKey.TRACE,
  ReplayFieldKey.URLS,
  ReplayFieldKey.URL,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  FieldKey.USER_IP,
  FieldKey.USER_USERNAME,
  ReplayFieldKey.USER_GEO_CITY,
  ReplayFieldKey.USER_GEO_COUNTRY_CODE,
  ReplayFieldKey.USER_GEO_REGION,
  ReplayFieldKey.USER_GEO_SUBDIVISION,
  ReplayFieldKey.VIEWED_BY_ME,
  FieldKey.OTA_UPDATES_CHANNEL,
  FieldKey.OTA_UPDATES_RUNTIME_VERSION,
  FieldKey.OTA_UPDATES_UPDATE_ID,
];

export const REPLAY_TAG_ALIASES = {
  [ReplayFieldKey.SCREEN]: ReplayFieldKey.URL,
  [ReplayFieldKey.SCREENS]: ReplayFieldKey.URL,
  [ReplayFieldKey.URLS]: ReplayFieldKey.URL,
};

const SMALL_INTEGER_VALUES = ['1', '10', '100', '1000'];

const REPLAY_FIELD_DEFINITIONS: Record<ReplayFieldKey, FieldDefinition> = {
  [ReplayFieldKey.ACTIVITY]: {
    desc: t('Amount of activity in the replay from 0 to 10'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.BROWSER_NAME]: {
    desc: t('Name of the browser'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.BROWSER_VERSION]: {
    desc: t('Version number of the browser'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.COUNT_DEAD_CLICKS]: {
    desc: t('Number of dead clicks in the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_RAGE_CLICKS]: {
    desc: t('Number of rage clicks in the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_ERRORS]: {
    desc: t('Number of issues in the replay with level=error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_INFOS]: {
    desc: t('Number of issues in the replay with level=info'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_SCREENS]: {
    desc: t('Number of screens visited within the replay. Alias of count_urls.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_SEGMENTS]: {
    desc: t('Number of segments in the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_TRACES]: {
    desc: t('Number of traces in the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_URLS]: {
    desc: t('Number of urls visited within the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.COUNT_WARNINGS]: {
    desc: t('Number of issues in the replay with level=warning'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
    defaultValue: SMALL_INTEGER_VALUES[0],
    values: SMALL_INTEGER_VALUES,
  },
  [ReplayFieldKey.DURATION]: {
    desc: t('Duration of the replay, in seconds'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION,
  },
  [ReplayFieldKey.ERROR_IDS]: {
    desc: t('Error instance'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [ReplayFieldKey.IS_ARCHIVED]: {
    desc: t('Whether the replay has been archived'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [ReplayFieldKey.OS_NAME]: {
    desc: t('Name of the Operating System'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.OS_VERSION]: {
    desc: t('Version number of the Operating System'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.REPLAY_TYPE]: {
    desc: t('The replay recording mode - "session" or "buffer"'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.SEEN_BY_ME]: {
    desc: t(
      'Whether you have seen this replay before. Alias of viewed_by_me. (true/false)'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [ReplayFieldKey.SCREEN]: {
    desc: t('A screen visited within the replay. Alias of url.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.SCREENS]: {
    desc: t('List of screens that were visited within the replay. Alias of urls.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.URL]: {
    desc: t('A url visited within the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.URLS]: {
    desc: t('List of urls that were visited within the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.USER_GEO_CITY]: EVENT_FIELD_DEFINITIONS[FieldKey.GEO_CITY],
  [ReplayFieldKey.USER_GEO_COUNTRY_CODE]:
    EVENT_FIELD_DEFINITIONS[FieldKey.GEO_COUNTRY_CODE],
  [ReplayFieldKey.USER_GEO_REGION]: EVENT_FIELD_DEFINITIONS[FieldKey.GEO_REGION],
  [ReplayFieldKey.USER_GEO_SUBDIVISION]:
    EVENT_FIELD_DEFINITIONS[FieldKey.GEO_SUBDIVISION],
  [ReplayFieldKey.VIEWED_BY_ME]: {
    desc: t('Whether you have seen this replay before. Alias of seen_by_me (true/false)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
};

export const REPLAY_CLICK_FIELDS = [
  ReplayClickFieldKey.CLICK_ALT,
  ReplayClickFieldKey.CLICK_CLASS,
  ReplayClickFieldKey.CLICK_ID,
  ReplayClickFieldKey.CLICK_LABEL,
  ReplayClickFieldKey.CLICK_ROLE,
  ReplayClickFieldKey.CLICK_SELECTOR,
  ReplayClickFieldKey.DEAD_SELECTOR,
  ReplayClickFieldKey.RAGE_SELECTOR,
  ReplayClickFieldKey.CLICK_TAG,
  ReplayClickFieldKey.CLICK_TEXT_CONTENT,
  ReplayClickFieldKey.CLICK_TITLE,
  ReplayClickFieldKey.CLICK_TESTID,
  ReplayClickFieldKey.CLICK_COMPONENT_NAME,
];

export const REPLAY_TAP_FIELDS = [
  ReplayTapFieldKey.TAP_MESSAGE,
  ReplayTapFieldKey.TAP_VIEW_ID,
  ReplayTapFieldKey.TAP_VIEW_CLASS,
];

// This is separated out from REPLAY_FIELD_DEFINITIONS so that it is feature-flaggable
const REPLAY_CLICK_FIELD_DEFINITIONS: Record<ReplayClickFieldKey, FieldDefinition> = {
  [ReplayClickFieldKey.CLICK_ALT]: {
    desc: t('`alt` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_CLASS]: {
    desc: t('`class` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_ID]: {
    desc: t('`id` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_LABEL]: {
    desc: t('`aria-label` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_ROLE]: {
    desc: t('`role` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_SELECTOR]: {
    desc: t(
      'query using CSS selector-like syntax, supports class, id, and attribute selectors'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [ReplayClickFieldKey.DEAD_SELECTOR]: {
    desc: t(
      'query using CSS selector-like syntax, supports class, id, and attribute selectors'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [ReplayClickFieldKey.RAGE_SELECTOR]: {
    desc: t(
      'query using CSS selector-like syntax, supports class, id, and attribute selectors'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
  },
  [ReplayClickFieldKey.CLICK_TAG]: {
    desc: t('`tag` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_TESTID]: {
    desc: t('`data-testid` or `data-test-id` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_TEXT_CONTENT]: {
    desc: t('textContent of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_TITLE]: {
    desc: t('`title` of an element that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayClickFieldKey.CLICK_COMPONENT_NAME]: {
    desc: t('the name of the frontend component that was clicked'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

const REPLAY_TAP_FIELD_DEFINITIONS: Record<ReplayTapFieldKey, FieldDefinition> = {
  [ReplayTapFieldKey.TAP_MESSAGE]: {
    desc: t('`Message` of an element that was tapped'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayTapFieldKey.TAP_VIEW_CLASS]: {
    desc: t('`View Class` of an element that was tapped'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayTapFieldKey.TAP_VIEW_ID]: {
    desc: t('`View ID` of an element that was tapped'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

export enum FeedbackFieldKey {
  AI_CATEGORIZATION_LABELS = 'ai_categorization.labels',
  BROWSER_NAME = 'browser.name',
  LOCALE_LANG = 'locale.lang',
  LOCALE_TIMEZONE = 'locale.timezone',
  MESSAGE = 'message',
  OS_NAME = 'os.name',
  OS_VERSION = 'os.version',
  URL = 'url',
}

export const FEEDBACK_FIELDS = [
  FeedbackFieldKey.AI_CATEGORIZATION_LABELS,
  FieldKey.ASSIGNED,
  FeedbackFieldKey.BROWSER_NAME,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_FAMILY,
  FieldKey.DEVICE_NAME,
  FieldKey.DIST,
  FieldKey.ENVIRONMENT,
  FieldKey.GEO_CITY,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.GEO_REGION,
  FieldKey.GEO_SUBDIVISION,
  FieldKey.HAS,
  FieldKey.ID,
  FieldKey.IS,
  FieldKey.LEVEL,
  FeedbackFieldKey.LOCALE_LANG,
  FeedbackFieldKey.LOCALE_TIMEZONE,
  FeedbackFieldKey.MESSAGE,
  FeedbackFieldKey.OS_NAME,
  FeedbackFieldKey.OS_VERSION,
  FieldKey.PLATFORM_NAME,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  FieldKey.TIMESTAMP,
  FieldKey.TRACE,
  FeedbackFieldKey.URL,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  FieldKey.USER_IP,
  FieldKey.USER_USERNAME,
];

const FEEDBACK_FIELD_DEFINITIONS: Record<FeedbackFieldKey, FieldDefinition> = {
  [FeedbackFieldKey.AI_CATEGORIZATION_LABELS]: {
    desc: t('AI-generated labels for categorizing feedback'),
    kind: FieldKind.TAG,
    valueType: FieldValueType.STRING,
    allowWildcard: true,
  },
  [FeedbackFieldKey.BROWSER_NAME]: {
    desc: t('Name of the browser'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FeedbackFieldKey.LOCALE_LANG]: {
    desc: t('Language preference of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FeedbackFieldKey.LOCALE_TIMEZONE]: {
    desc: t('Timezone the feedback was submitted from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FeedbackFieldKey.MESSAGE]: {
    desc: t(
      'Message written by the user providing feedback. Search is case insensitive and supports substrings.'
    ),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: true,
  },
  [FeedbackFieldKey.OS_NAME]: {
    desc: t('Name of the operating system'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FeedbackFieldKey.OS_VERSION]: {
    desc: t('Version number of the operating system'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FeedbackFieldKey.URL]: {
    desc: t('URL of the page that the feedback is triggered on'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

export const getFieldDefinition = (
  key: string,
  type:
    | 'event'
    | 'replay'
    | 'replay_click'
    | 'feedback'
    | 'span'
    | 'log'
    | 'uptime'
    | 'tracemetric' = 'event',
  kind?: FieldKind
): FieldDefinition | null => {
  switch (type) {
    case 'replay':
      if (REPLAY_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        return REPLAY_FIELD_DEFINITIONS[key as keyof typeof REPLAY_FIELD_DEFINITIONS];
      }
      if (REPLAY_CLICK_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        return REPLAY_CLICK_FIELD_DEFINITIONS[
          key as keyof typeof REPLAY_CLICK_FIELD_DEFINITIONS
        ];
      }
      if (REPLAY_TAP_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        return REPLAY_TAP_FIELD_DEFINITIONS[
          key as keyof typeof REPLAY_TAP_FIELD_DEFINITIONS
        ];
      }
      if (REPLAY_FIELDS.includes(key as FieldKey)) {
        return EVENT_FIELD_DEFINITIONS[key as FieldKey];
      }
      return null;
    case 'feedback':
      if (FEEDBACK_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        return FEEDBACK_FIELD_DEFINITIONS[key as keyof typeof FEEDBACK_FIELD_DEFINITIONS];
      }
      if (FEEDBACK_FIELDS.includes(key as FieldKey)) {
        return EVENT_FIELD_DEFINITIONS[key as FieldKey];
      }
      return null;
    case 'span':
      if (SPAN_FIELD_DEFINITIONS[key]) {
        return SPAN_FIELD_DEFINITIONS[key];
      }

      // In EAP we have numeric tags that can be passed as parameters to
      // aggregate functions. We assign value type based on kind, so that we can filter
      // on them when suggesting function parameters.
      if (kind === FieldKind.MEASUREMENT) {
        return {kind: FieldKind.FIELD, valueType: FieldValueType.NUMBER};
      }

      if (kind === FieldKind.TAG) {
        return {kind: FieldKind.FIELD, valueType: FieldValueType.STRING};
      }

      return null;

    case 'log':
      if (LOG_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        return LOG_FIELD_DEFINITIONS[key];
      }

      // In EAP we have numeric tags that can be passed as parameters to
      // aggregate functions. We assign value type based on kind, so that we can filter
      // on them when suggesting function parameters.
      if (kind === FieldKind.MEASUREMENT) {
        return {kind: FieldKind.FIELD, valueType: FieldValueType.NUMBER};
      }

      if (kind === FieldKind.TAG) {
        return {kind: FieldKind.FIELD, valueType: FieldValueType.STRING};
      }
      return null;

    case 'tracemetric':
      if (TRACEMETRIC_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        return TRACEMETRIC_FIELD_DEFINITIONS[key];
      }

      // In EAP we have numeric tags that can be passed as parameters to
      // aggregate functions. We assign value type based on kind, so that we can filter
      // on them when suggesting function parameters.
      if (kind === FieldKind.MEASUREMENT) {
        return {kind: FieldKind.FIELD, valueType: FieldValueType.NUMBER};
      }

      if (kind === FieldKind.TAG) {
        return {kind: FieldKind.FIELD, valueType: FieldValueType.STRING};
      }
      return null;

    case 'event':
    default:
      if (EVENT_FIELD_DEFINITIONS.hasOwnProperty(key)) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        return EVENT_FIELD_DEFINITIONS[key];
      }
      return null;
  }
};

export function makeTagCollection(fieldKeys: FieldKey[]): TagCollection {
  return Object.fromEntries(
    fieldKeys.map(fieldKey => [
      fieldKey,
      {key: fieldKey, name: fieldKey, kind: getFieldDefinition(fieldKey)?.kind},
    ])
  );
}

export function isDeviceClass(key: any): boolean {
  return key === FieldKey.DEVICE_CLASS;
}

export const DEVICE_CLASS_TAG_VALUES = ['high', 'medium', 'low'];

const TYPED_TAG_KEY_RE = /tags\[([^\s]*),([^\s]*)\]/;

export function classifyTagKey(key: string): FieldKind {
  const result = key.match(TYPED_TAG_KEY_RE);
  return result?.[2] === 'number' ? FieldKind.MEASUREMENT : FieldKind.TAG;
}

export function prettifyTagKey(key: string): string {
  const result = key.match(TYPED_TAG_KEY_RE);
  return result?.[1] ?? key;
}
