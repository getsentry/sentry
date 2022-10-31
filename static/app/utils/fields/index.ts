import {t} from 'sentry/locale';

export enum FieldKind {
  TAG = 'tag',
  MEASUREMENT = 'measurement',
  BREAKDOWN = 'breakdown',
  FIELD = 'field',
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
  CULPRIT = 'culprit',
  DEVICE_ARCH = 'device.arch',
  DEVICE_BATTERY_LEVEL = 'device.battery_level',
  DEVICE_BRAND = 'device.brand',
  DEVICE_CHARGING = 'device.charging',
  DEVICE_FAMILY = 'device.family',
  DEVICE_LOCALE = 'device.locale',
  DEVICE_MODEL_ID = 'device.model_id',
  DEVICE_NAME = 'device.name',
  DEVICE_ONLINE = 'device.online',
  DEVICE_ORIENTATION = 'device.orientation',
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
  EVENT_TIMESTAMP = 'event.timestamp',
  EVENT_TYPE = 'event.type',
  FIRST_RELEASE = 'firstRelease',
  FIRST_SEEN = 'firstSeen',
  GEO_CITY = 'geo.city',
  GEO_COUNTRY_CODE = 'geo.country_code',
  GEO_REGION = 'geo.region',
  HAS = 'has',
  HTTP_METHOD = 'http.method',
  HTTP_REFERER = 'http.referer',
  HTTP_STATUS_CODE = 'http.status_code',
  HTTP_URL = 'http.url',
  ID = 'id',
  IS = 'is',
  ISSUE = 'issue',
  ISSUE_CATEGORY = 'issue.category',
  ISSUE_TYPE = 'issue.type',
  LAST_SEEN = 'lastSeen',
  LEVEL = 'level',
  LOCATION = 'location',
  MESSAGE = 'message',
  OS = 'os',
  OS_BUILD = 'os.build',
  OS_KERNEL_VERSION = 'os.kernel_version',
  PLATFORM = 'platform',
  PLATFORM_NAME = 'platform.name',
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
  TIMESTAMP = 'timestamp',
  TIMESTAMP_TO_DAY = 'timestamp.to_day',
  TIMESTAMP_TO_HOUR = 'timestamp.to_hour',
  TIMES_SEEN = 'timesSeen',
  TITLE = 'title',
  TRACE = 'trace',
  TRACE_PARENT_SPAN = 'trace.parent_span',
  TRACE_SPAN = 'trace.span',
  TRANSACTION = 'transaction',
  TRANSACTION_DURATION = 'transaction.duration',
  TRANSACTION_OP = 'transaction.op',
  TRANSACTION_STATUS = 'transaction.status',
  USER = 'user',
  USER_DISPLAY = 'user.display',
  USER_EMAIL = 'user.email',
  USER_ID = 'user.id',
  USER_IP = 'user.ip',
  USER_USERNAME = 'user.username',
}

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
}

export enum WebVital {
  FP = 'measurements.fp',
  FCP = 'measurements.fcp',
  LCP = 'measurements.lcp',
  FID = 'measurements.fid',
  CLS = 'measurements.cls',
  TTFB = 'measurements.ttfb',
  RequestTime = 'measurements.ttfb.requesttime',
}

export enum MobileVital {
  AppStartCold = 'measurements.app_start_cold',
  AppStartWarm = 'measurements.app_start_warm',
  FramesTotal = 'measurements.frames_total',
  FramesSlow = 'measurements.frames_slow',
  FramesFrozen = 'measurements.frames_frozen',
  FramesSlowRate = 'measurements.frames_slow_rate',
  FramesFrozenRate = 'measurements.frames_frozen_rate',
  StallCount = 'measurements.stall_count',
  StallTotalTime = 'measurements.stall_total_time',
  StallLongestTime = 'measurements.stall_longest_time',
  StallPercentage = 'measurements.stall_percentage',
}

export enum SpanOpBreakdown {
  SpansBrowser = 'spans.browser',
  SpansDb = 'spans.db',
  SpansHttp = 'spans.http',
  SpansResource = 'spans.resource',
  SpansUi = 'spans.ui',
}

export enum AggregationKey {
  Count = 'count',
  CountUnique = 'count_unique',
  CountMiserable = 'count_miserable',
  CountIf = 'count_if',
  CountWebVitals = 'count_web_vitals',
  Eps = 'eps',
  Epm = 'epm',
  FailureCount = 'failure_count',
  Min = 'min',
  Max = 'max',
  Sum = 'sum',
  Any = 'any',
  P50 = 'p50',
  P75 = 'p75',
  P95 = 'p95',
  P99 = 'p99',
  P100 = 'p100',
  Percentile = 'percentile',
  Avg = 'avg',
  Apdex = 'apdex',
  UserMisery = 'user_misery',
  FailureRate = 'failure_rate',
  LastSeen = 'last_seen',
}

export interface FieldDefinition {
  kind: FieldKind;
  valueType: FieldValueType | null;
  /**
   * Is this field being deprecated
   */
  deprecated?: boolean;
  /**
   * Description of the field
   */
  desc?: string;
  /**
   * Feature flag that indicates gating of the field from use
   */
  featureFlag?: string;
  /**
   * Additional keywords used when filtering via autocomplete
   */
  keywords?: string[];
}

export const AGGREGATION_FIELDS: Record<AggregationKey, FieldDefinition> = {
  [AggregationKey.Count]: {
    desc: t('count of events'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.CountUnique]: {
    desc: t('Unique count of the field values'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.INTEGER,
  },
  [AggregationKey.CountMiserable]: {
    desc: t('Count of unique miserable users'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.CountIf]: {
    desc: t('Count of events matching the parameter conditions'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.CountWebVitals]: {
    desc: t('Count of web vitals with a specific status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.Eps]: {
    desc: t('Events per second'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.Epm]: {
    desc: t('Events per minute'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.FailureRate]: {
    desc: t('Failed event percentage based on transaction.status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.PERCENTAGE,
  },
  [AggregationKey.FailureCount]: {
    desc: t('Failed event count based on transaction.status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER,
  },
  [AggregationKey.Min]: {
    desc: t('Returns the minimum value of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.Max]: {
    desc: t('Returns maximum value of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.Sum]: {
    desc: t('Returns the total value for the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.Any]: {
    desc: t('Not Recommended, a random field value'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.P50]: {
    desc: t('Returns the 50th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.P75]: {
    desc: t('Returns the 75th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.P95]: {
    desc: t('Returns the 95th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.P99]: {
    desc: t('Returns the 99th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.P100]: {
    desc: t('Returns the 100th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.Percentile]: {
    desc: t('Returns the percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.Avg]: {
    desc: t('Returns averages for a selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.Apdex]: {
    desc: t('Performance score based on a duration threshold'),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.UserMisery]: {
    desc: t(
      'User-weighted performance metric that counts the number of unique users who were frustrated'
    ),
    kind: FieldKind.FUNCTION,
    valueType: null,
  },
  [AggregationKey.LastSeen]: {
    desc: t('Issues last seen at a date and time'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.DATE,
  },
};

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
  [WebVital.RequestTime]: {
    desc: t('Time between start of request to start of response'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.AppStartCold]: {
    desc: t('First launch (not in memory and no process exists)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.AppStartWarm]: {
    desc: t('Already launched (partial memory and process may exist)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [MobileVital.FramesTotal]: {
    desc: t('Total number of frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.FramesSlow]: {
    desc: t('Number of slow frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.FramesFrozen]: {
    desc: t('Number of frozen frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.FramesSlowRate]: {
    desc: t('Number of slow frames out of the total'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
  [MobileVital.FramesFrozenRate]: {
    desc: t('Number of frozen frames out of the total'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
  [MobileVital.StallCount]: {
    desc: t('Count of slow Javascript event loops (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.StallTotalTime]: {
    desc: t('Total stall duration (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
  [MobileVital.StallLongestTime]: {
    desc: t('Duration of slowest Javascript event loop (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER,
  },
  [MobileVital.StallPercentage]: {
    desc: t('Total stall duration out of the total transaction duration (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE,
  },
};

export const SPAN_OP_FIELDS: Record<SpanOpBreakdown, FieldDefinition> = {
  [SpanOpBreakdown.SpansBrowser]: {
    desc: t('Cumulative time based on the browser operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SpansDb]: {
    desc: t('Cumulative time based on the database operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SpansHttp]: {
    desc: t('Cumulative time based on the http operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SpansResource]: {
    desc: t('Cumulative time based on the resource operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
  [SpanOpBreakdown.SpansUi]: {
    desc: t('Cumulative time based on the ui operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION,
  },
};

type AllEventFieldKeys =
  | keyof typeof AGGREGATION_FIELDS
  | keyof typeof MEASUREMENT_FIELDS
  | keyof typeof SPAN_OP_FIELDS
  | FieldKey;

const EVENT_FIELD_DEFINITIONS: Record<AllEventFieldKeys, FieldDefinition> = {
  ...AGGREGATION_FIELDS,
  ...MEASUREMENT_FIELDS,
  ...SPAN_OP_FIELDS,
  [FieldKey.AGE]: {
    desc: t('The age of the issue in relative time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION,
  },
  [FieldKey.ASSIGNED]: {
    desc: t('Assignee of the issue as a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ASSIGNED_OR_SUGGESTED]: {
    desc: t('Assignee or suggestee of the issue as a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.CULPRIT]: {
    deprecated: true,
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.BOOKMARKS]: {
    desc: t('The issues bookmarked by a user ID'),
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
    desc: t('Descriptor details'),
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
  [FieldKey.DEVICE_SIMULATOR]: {
    desc: t('Indicates if it occured on a simulator'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_UUID]: {
    desc: t('Unique device identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
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
  [FieldKey.EVENT_TIMESTAMP]: {
    desc: t('Date and time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.EVENT_TYPE]: {
    desc: t('Type of event (Errors, transactions, csp and default)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
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
  },
  [FieldKey.IS]: {
    desc: t('The properties of an issue (i.e. Resolved, unresolved)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    keywords: ['ignored', 'assigned', 'for_review', 'unassigned', 'linked', 'unlinked'],
  },
  [FieldKey.ISSUE]: {
    desc: t('The issue identification code'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ISSUE_CATEGORY]: {
    desc: t('Category of issue (error or performance)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    keywords: ['error', 'performance'],
    featureFlag: 'performance-issues',
  },
  [FieldKey.ISSUE_TYPE]: {
    desc: t('Type of problem the issue represents (i.e. N+1 Query)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    featureFlag: 'performance-issues',
  },
  [FieldKey.LAST_SEEN]: {
    desc: t('Issues last seen at a given time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.LEVEL]: {
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.LOCATION]: {
    desc: t('Location of error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.MESSAGE]: {
    desc: t('Error message or transaction name'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
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
  [FieldKey.OS_KERNEL_VERSION]: {
    desc: t('Version number'),
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
  [FieldKey.PROJECT]: {
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
  [FieldKey.HAS]: {
    desc: t('Determines if a tag or field exists in an event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE]: {
    desc: t('The version of your code deployed to an environment'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_BUILD]: {
    desc: t('The full version number that identifies the iteration'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_PACKAGE]: {
    desc: t('The identifier unique to the project or application'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_STAGE]: {
    desc: t('Stage of usage (i.e., adopted, replaced, low)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_VERSION]: {
    desc: t('An abbreviated version number of the build'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.REPLAY_ID]: {
    desc: t('The ID of an associated Session Replay'),
    kind: FieldKind.TAG,
    valueType: FieldValueType.STRING,
  },
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
  [FieldKey.TIMES_SEEN]: {
    desc: t('Total number of events'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
    keywords: ['count'],
  },
  [FieldKey.TIMESTAMP]: {
    desc: t('The time an event finishes'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE,
  },
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
  [FieldKey.TITLE]: {
    desc: t('Error or transaction name identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE]: {
    desc: t('The trace identification number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE_PARENT_SPAN]: {
    desc: t('Span identification number of the parent to the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE_SPAN]: {
    desc: t('Span identification number of the root span'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION]: {
    desc: t('Error or transaction name identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_OP]: {
    desc: t('Short code identifying the type of operation the span is measuring'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_DURATION]: {
    desc: t('Duration, in milliseconds, of the transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION,
  },
  [FieldKey.TRANSACTION_STATUS]: {
    desc: t('Describes the status of the span/transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
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
};

export const ISSUE_FIELDS = [
  FieldKey.AGE,
  FieldKey.ASSIGNED,
  FieldKey.ASSIGNED_OR_SUGGESTED,
  FieldKey.BOOKMARKS,
  FieldKey.DEVICE_ARCH,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_FAMILY,
  FieldKey.DEVICE_LOCALE,
  FieldKey.DEVICE_LOCALE,
  FieldKey.DEVICE_MODEL_ID,
  FieldKey.DEVICE_ORIENTATION,
  FieldKey.DEVICE_UUID,
  FieldKey.DIST,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_VALUE,
  FieldKey.EVENT_TIMESTAMP,
  FieldKey.EVENT_TYPE,
  FieldKey.FIRST_RELEASE,
  FieldKey.FIRST_SEEN,
  FieldKey.GEO_CITY,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.GEO_REGION,
  FieldKey.HAS,
  FieldKey.HTTP_METHOD,
  FieldKey.HTTP_REFERER,
  FieldKey.HTTP_STATUS_CODE,
  FieldKey.HTTP_URL,
  FieldKey.ID,
  FieldKey.IS,
  FieldKey.ISSUE_CATEGORY,
  FieldKey.LAST_SEEN,
  FieldKey.LOCATION,
  FieldKey.MESSAGE,
  FieldKey.OS_BUILD,
  FieldKey.OS_KERNEL_VERSION,
  FieldKey.PLATFORM,
  FieldKey.RELEASE,
  FieldKey.RELEASE_BUILD,
  FieldKey.RELEASE_PACKAGE,
  FieldKey.RELEASE_STAGE,
  FieldKey.RELEASE_VERSION,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  FieldKey.STACK_ABS_PATH,
  FieldKey.STACK_FILENAME,
  FieldKey.STACK_FUNCTION,
  FieldKey.STACK_MODULE,
  FieldKey.STACK_PACKAGE,
  FieldKey.STACK_STACK_LEVEL,
  FieldKey.TIMESTAMP,
  FieldKey.TIMES_SEEN,
  FieldKey.TITLE,
  FieldKey.TRACE,
  FieldKey.TRANSACTION,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  FieldKey.USER_IP,
  FieldKey.USER_USERNAME,
];

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
  FieldKey.PLATFORM_NAME,
  FieldKey.ENVIRONMENT,
  FieldKey.RELEASE,
  FieldKey.DIST,
  FieldKey.TITLE,
  FieldKey.EVENT_TYPE,
  // tags.key and tags.value are omitted on purpose as well.

  FieldKey.TRANSACTION,
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
  FieldKey.DEVICE_NAME,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_LOCALE,
  FieldKey.DEVICE_UUID,
  FieldKey.DEVICE_ARCH,
  FieldKey.DEVICE_FAMILY,
  FieldKey.DEVICE_BATTERY_LEVEL,
  FieldKey.DEVICE_ORIENTATION,
  FieldKey.DEVICE_SIMULATOR,
  FieldKey.DEVICE_ONLINE,
  FieldKey.DEVICE_CHARGING,
  FieldKey.GEO_COUNTRY_CODE,
  FieldKey.GEO_REGION,
  FieldKey.GEO_CITY,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_VALUE,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_RECEIVED,
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
  // contexts.key and contexts.value omitted on purpose.

  // Transaction event fields.
  FieldKey.TRANSACTION_DURATION,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,

  FieldKey.TRACE,
  FieldKey.TRACE_SPAN,
  FieldKey.TRACE_PARENT_SPAN,

  // Field alises defined in src/sentry/api/event_search.py
  FieldKey.PROJECT,
  FieldKey.ISSUE,
  FieldKey.USER_DISPLAY,

  // Span Op fields
  SpanOpBreakdown.SpansBrowser,
  SpanOpBreakdown.SpansDb,
  SpanOpBreakdown.SpansHttp,
  SpanOpBreakdown.SpansResource,
  SpanOpBreakdown.SpansUi,
];

enum ReplayFieldKey {
  BROWSER_NAME = 'browser.name',
  BROWSER_VERSION = 'browser.version',
  COUNT_ERRORS = 'countErrors',
  COUNT_SEGMENTS = 'countSegments',
  // COUNT_URLS = 'countUrls',
  DEVICE_MODEL = 'device.model',
  DURATION = 'duration',
  // ERROR_IDS = 'errorIds',
  // LONGEST_TRANSACTION = 'longestTransaction',
  OS_NAME = 'os.name',
  OS_VERSION = 'os.version',
  RELEASES = 'releases',
  // TRACE_IDS = 'traceIds',
  URLS = 'urls',
  USER_IP_ADDRESS = 'user.ipAddress',
  USER_NAME = 'user.name',
}

export const REPLAY_FIELDS = [
  ReplayFieldKey.BROWSER_NAME,
  ReplayFieldKey.BROWSER_VERSION,
  ReplayFieldKey.COUNT_ERRORS,
  ReplayFieldKey.COUNT_SEGMENTS,
  FieldKey.DEVICE_BRAND,
  FieldKey.DEVICE_FAMILY,
  ReplayFieldKey.DEVICE_MODEL,
  FieldKey.DEVICE_NAME,
  FieldKey.DIST,
  ReplayFieldKey.DURATION,
  FieldKey.ID,
  ReplayFieldKey.OS_NAME,
  ReplayFieldKey.OS_VERSION,
  FieldKey.PLATFORM,
  ReplayFieldKey.RELEASES,
  FieldKey.SDK_NAME,
  FieldKey.SDK_VERSION,
  ReplayFieldKey.URLS,
  FieldKey.USER_EMAIL,
  FieldKey.USER_ID,
  ReplayFieldKey.USER_IP_ADDRESS,
  ReplayFieldKey.USER_NAME,
];

const REPLAY_FIELD_DEFINITIONS: Record<ReplayFieldKey, FieldDefinition> = {
  [ReplayFieldKey.BROWSER_NAME]: {
    desc: t('Name of the brower'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.BROWSER_VERSION]: {
    desc: t('Version number of the Browser'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.COUNT_ERRORS]: {
    desc: t('Number of errors in the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
  },
  [ReplayFieldKey.COUNT_SEGMENTS]: {
    desc: t('Number of segments in the replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.INTEGER,
  },
  [ReplayFieldKey.DEVICE_MODEL]: {
    desc: t('Model of device'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.DURATION]: {
    desc: t('Duration of the replay, in seconds'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION,
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
  [ReplayFieldKey.RELEASES]: {
    desc: t('Releases this Replay spans across'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.URLS]: {
    desc: t('List of urls that were visited within the Replay'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.USER_IP_ADDRESS]: {
    desc: t('IP Address of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [ReplayFieldKey.USER_NAME]: {
    desc: t('Name of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

export const getFieldDefinition = (
  key: string,
  type: 'event' | 'replay' = 'event'
): FieldDefinition | null => {
  switch (type) {
    case 'replay':
      if (key in REPLAY_FIELD_DEFINITIONS) {
        return REPLAY_FIELD_DEFINITIONS[key];
      }
      if (REPLAY_FIELDS.includes(key as FieldKey)) {
        return EVENT_FIELD_DEFINITIONS[key];
      }
      return null;
    case 'event':
    default:
      return EVENT_FIELD_DEFINITIONS[key] ?? null;
  }
};
