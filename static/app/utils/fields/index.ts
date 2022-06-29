export enum FieldValueKind {
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
  EVENT_TIMESTAMP = 'event.timestamp',
  EVENT_TYPE = 'event.type',
  GEO_CITY = 'geo.city',
  GEO_COUNTRY_CODE = 'geo.country_code',
  GEO_REGION = 'geo.region',
  HTTP_METHOD = 'http.method',
  HTTP_REFERER = 'http.referer',
  HTTP_STATUS_CODE = 'http.status_code',
  HTTP_URL = 'http.url',
  ID = 'id',
  IS = 'is',
  ISSUE = 'issue',
  LAST_SEEN = 'lastSeen',
  LEVEL = 'level',
  LOCATION = 'location',
  MESSAGE = 'message',
  OS = 'os',
  OS_BUILD = 'os.build',
  OS_KERNEL_VERSION = 'os.kernel_version',
  PLATFORM_NAME = 'platform.name',
  PROJECT = 'project',
  RELEASE = 'release',
  RELEASE_BUILD = 'release.build',
  RELEASE_PACKAGE = 'release.package',
  RELEASE_STAGE = 'release.stage',
  RELEASE_VERSION = 'release.version',
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
}

export interface FieldDefinition {
  kind: FieldValueKind;
  valueType: FieldValueType;
  desc?: string;
}

export const FIELDS: Record<string, FieldDefinition> = {
  [FieldKey.AGE]: {
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.DURATION,
  },
  [FieldKey.ASSIGNED]: {
    desc: 'Assignee of the issue as a user ID',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.CULPRIT]: {
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.BOOKMARKS]: {
    desc: 'The issues bookmarked by a user ID',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_ARCH]: {
    desc: 'CPU architecture',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_BATTERY_LEVEL]: {
    desc: 'Indicator of how much battery is at',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_BRAND]: {
    desc: 'Brand of device',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_CHARGING]: {
    desc: 'Charging at the time of the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_FAMILY]: {
    desc: 'Model name across generations',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_LOCALE]: {
    desc: "The locale of the user's device",
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_MODEL_ID]: {
    desc: 'Internal hardware revision',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_NAME]: {
    desc: 'Descriptor details',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_ONLINE]: {
    desc: 'Online at the time of the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_ORIENTATION]: {
    desc: 'Portrait or landscape view ',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.DEVICE_SIMULATOR]: {
    desc: 'Determines if it occured on a simulator',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.DEVICE_UUID]: {
    desc: 'Unique device identifier',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ERROR_HANDLED]: {
    desc: 'Determines handling status of the error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.ERROR_MECHANISM]: {
    desc: 'The mechanism that created the error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ERROR_TYPE]: {
    desc: 'The type of exception',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ERROR_UNHANDLED]: {
    desc: 'Determines unhandling status of the error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.BOOLEAN,
  },
  [FieldKey.ERROR_VALUE]: {
    desc: 'Original value that exhibits error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.EVENT_TIMESTAMP]: {
    desc: 'Original value that exhibits error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.EVENT_TYPE]: {
    desc: 'Original value that exhibits error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.GEO_CITY]: {
    desc: 'Full name of the city',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.GEO_COUNTRY_CODE]: {
    desc: 'Country code based on ISO 3166-1',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.GEO_REGION]: {
    desc: 'Full name of the country',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_METHOD]: {
    desc: 'Method of the request that created the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_REFERER]: {
    desc: 'The web page the resource was requested from',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_STATUS_CODE]: {
    desc: 'Type of response (i.e. 200, 404)',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.HTTP_URL]: {
    desc: 'Full URL of the request without parameters',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ID]: {
    desc: 'The event identification number',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.IS]: {
    desc: 'The properties of an issue (i.e. Resolved, unresolved)',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.ISSUE]: {
    desc: 'The issue identification code',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.LAST_SEEN]: {
    desc: 'Issues last seen at a given time',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.LEVEL]: {
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.LOCATION]: {
    desc: 'Location of error',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.MESSAGE]: {
    desc: 'Matches the error message or transaction name',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS]: {
    desc: 'Build and kernel version',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_BUILD]: {
    desc: 'Name of the build',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.OS_KERNEL_VERSION]: {
    desc: 'Version number',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.PLATFORM_NAME]: {
    desc: 'Name of the platform',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.PROJECT]: {
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE]: {
    desc: 'The version of your code deployed to an environment',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_BUILD]: {
    desc: 'The full version number that identifies the iteration',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_PACKAGE]: {
    desc: 'The identifier unique to the project or application',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_STAGE]: {
    desc: 'Stage of usage (i.e. Adopted, replaced, low)',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.RELEASE_VERSION]: {
    desc: 'An abbreviated version number of the build',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.SDK_NAME]: {
    desc: 'Name of the platform that sent the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.SDK_VERSION]: {
    desc: 'Version of the platform that sent the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_ABS_PATH]: {
    desc: 'Absolute path to the source file',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_COLNO]: {
    desc: 'Column number of the call starting at 1',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_FILENAME]: {
    desc: 'Relative path to the source file from the root directory',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_FUNCTION]: {
    desc: 'Name of function being called',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_IN_APP]: {
    desc: 'Indicates if frame is related to relevant code in stack trace',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_LINENO]: {
    desc: 'Line number of the call starting at 1',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_MODULE]: {
    desc: 'Platform specific module path',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_PACKAGE]: {
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_RESOURCE]: {
    desc: 'The package the frame is from',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.STACK_STACK_LEVEL]: {
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TIMES_SEEN]: {
    desc: 'Total number of events',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TIMESTAMP]: {
    desc: 'The time an event finishes',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.TIMESTAMP_TO_HOUR]: {
    desc: 'Rounded down to the nearest day',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.TIMESTAMP_TO_DAY]: {
    desc: 'Rounded down to the nearest hour',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.DATE,
  },
  [FieldKey.TITLE]: {
    desc: 'Error or transaction name identifier',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE]: {
    desc: 'The trace identification number',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE_PARENT_SPAN]: {
    desc: 'Span identification number of the parent to the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRACE_SPAN]: {
    desc: 'Span identification number of the root span ',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION]: {
    desc: 'Error or transaction name identifier',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_OP]: {
    desc: 'The trace identification number',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_DURATION]: {
    desc: 'Span identification number of the parent to the event',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.TRANSACTION_STATUS]: {
    desc: 'Span identification number of the root span ',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER]: {
    desc: 'User identification value',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_DISPLAY]: {
    desc: 'The first user field available of email, username, ID and IP',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_EMAIL]: {
    desc: 'Email address of the user',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_ID]: {
    desc: 'Application specific internal identifier of the user',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_IP]: {
    desc: 'IP Address of the user',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
  [FieldKey.USER_USERNAME]: {
    desc: 'Username of the user',
    kind: FieldValueKind.FIELD,
    valueType: FieldValueType.STRING,
  },
};

export const getFieldDefinition = (key: string): FieldDefinition | null => {
  return FIELDS[key] ?? null;
};
