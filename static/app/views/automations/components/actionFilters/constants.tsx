import {t} from 'sentry/locale';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';

export const FILTER_MATCH_OPTIONS: Array<{
  label: string;
  value: DataConditionGroupLogicType;
  alias?: DataConditionGroupLogicType;
}> = [
  {value: DataConditionGroupLogicType.ALL, label: t('all')},
  {
    value: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
    label: t('any'),
    // We do not expose ANY as a valid option because it should be equivalent to ANY_SHORT_CIRCUIT.
    // However, it is valid, so we need to handle it in the UI.
    alias: DataConditionGroupLogicType.ANY,
  },
  {value: DataConditionGroupLogicType.NONE, label: t('none')},
];

export enum MatchType {
  CONTAINS = 'co',
  ENDS_WITH = 'ew',
  EQUAL = 'eq',
  GREATER_OR_EQUAL = 'gte',
  GREATER = 'gt',
  IS_SET = 'is',
  IS_IN = 'in',
  LESS_OR_EQUAL = 'lte',
  LESS = 'lt',
  NOT_CONTAINS = 'nc',
  NOT_ENDS_WITH = 'new',
  NOT_EQUAL = 'ne',
  NOT_SET = 'ns',
  NOT_STARTS_WITH = 'nsw',
  NOT_IN = 'nin',
  STARTS_WITH = 'sw',
}

export enum Priority {
  LOW = 25,
  MEDIUM = 50,
  HIGH = 75,
}

export enum AgeComparison {
  OLDER = 'older',
  NEWER = 'newer',
}

export enum TimeUnit {
  MINUTES = 'minute',
  HOURS = 'hour',
  DAYS = 'day',
  WEEKS = 'week',
}

export enum TargetType {
  UNASSIGNED = 'Unassigned',
  TEAM = 'Team',
  MEMBER = 'Member',
}

export enum ModelAge {
  OLDEST = 'oldest',
  NEWEST = 'newest',
}

export enum Attribute {
  MESSAGE = 'message',
  PLATFORM = 'platform',
  ENVIRONMENT = 'environment',
  TYPE = 'type',
  ERROR_HANDLED = 'error.handled',
  ERROR_UNHANDLED = 'error.unhandled',
  ERROR_MAIN_THREAD = 'error.main_thread',
  EXCEPTION_TYPE = 'exception.type',
  ERROR_VALUE = 'exception.value',
  USER_ID = 'user.id',
  USER_EMAIL = 'user.email',
  USER_USERNAME = 'user.username',
  USER_IP_ADDRESS = 'user.ip_address',
  HTTP_METHOD = 'http.method',
  HTTP_URL = 'http.url',
  HTTP_STATUS_CODE = 'http.status_code',
  SDK_NAME = 'sdk.name',
  STACKTRACE_CODE = 'stacktrace.code',
  STACKTRACE_MODULE = 'stacktrace.module',
  STACKTRACE_FILENAME = 'stacktrace.filename',
  STACKTRACE_ABS_PATH = 'stacktrace.abs_path',
  STACKTRACE_PACKAGE = 'stacktrace.package',
  UNREAL_CRASH_TYPE = 'unreal.crash_type',
  APP_IN_FOREGROUND = 'app.in_foreground',
  OS_DISTRIBUTION_NAME = 'os.distribution_name',
  OS_DISTRIBUTION_VERSION = 'os.distribution_version',
}

export enum Level {
  FATAL = 50,
  ERROR = 40,
  WARNING = 30,
  INFO = 20,
  DEBUG = 10,
  SAMPLING = 0,
}

export enum Interval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d',
  ONE_WEEK = '1w',
  THIRTY_DAYS = '30d',
}

export const MATCH_CHOICES = [
  {value: MatchType.CONTAINS, label: 'contains'},
  {value: MatchType.EQUAL, label: 'equals'},
  {value: MatchType.STARTS_WITH, label: 'starts with'},
  {value: MatchType.ENDS_WITH, label: 'ends with'},
  {value: MatchType.NOT_CONTAINS, label: 'does not contain'},
  {value: MatchType.NOT_EQUAL, label: 'does not equal'},
  {value: MatchType.NOT_STARTS_WITH, label: 'does not start with'},
  {value: MatchType.NOT_ENDS_WITH, label: 'does not end with'},
  {value: MatchType.IS_SET, label: 'is set'},
  {value: MatchType.NOT_SET, label: 'is not set'},
  {value: MatchType.IS_IN, label: 'is one of'},
  {value: MatchType.NOT_IN, label: 'is not one of'},
];

export const PRIORITY_CHOICES = [
  {value: Priority.HIGH, label: t('high')},
  {value: Priority.MEDIUM, label: t('medium')},
  {value: Priority.LOW, label: t('low')},
];

export const AGE_COMPARISON_CHOICES = [
  {
    value: AgeComparison.OLDER,
    label: t('older than'),
  },
  {
    value: AgeComparison.NEWER,
    label: t('newer than'),
  },
];

export const MODEL_AGE_CHOICES = [
  {
    value: ModelAge.OLDEST,
    label: t('oldest'),
  },
  {
    value: ModelAge.NEWEST,
    label: t('newest'),
  },
];

export const LEVEL_MATCH_CHOICES = [
  {value: MatchType.EQUAL, label: t('equals')},
  {value: MatchType.GREATER_OR_EQUAL, label: t('greater than or equal')},
  {value: MatchType.LESS_OR_EQUAL, label: t('less than or equal')},
];

export const LEVEL_CHOICES = [
  {value: Level.FATAL, label: t('fatal')},
  {value: Level.ERROR, label: t('error')},
  {value: Level.WARNING, label: t('warning')},
  {value: Level.INFO, label: t('info')},
  {value: Level.DEBUG, label: t('debug')},
  {value: Level.SAMPLING, label: t('sampling')},
];

export const INTERVAL_CHOICES = [
  {value: Interval.ONE_MINUTE, label: t('in one minute')},
  {value: Interval.FIVE_MINUTES, label: t('in 5 minutes')},
  {value: Interval.FIFTEEN_MINUTES, label: t('in 15 minutes')},
  {value: Interval.ONE_HOUR, label: t('in one hour')},
  {value: Interval.ONE_DAY, label: t('in one day')},
  {value: Interval.ONE_WEEK, label: t('in one week')},
  {value: Interval.THIRTY_DAYS, label: t('in 30 days')},
];

export const COMPARISON_INTERVAL_CHOICES = [
  {value: Interval.FIVE_MINUTES, label: t('5 minutes ago')},
  {value: Interval.FIFTEEN_MINUTES, label: t('15 minutes ago')},
  {value: Interval.ONE_HOUR, label: t('one hour ago')},
  {value: Interval.ONE_DAY, label: t('one day ago')},
  {value: Interval.ONE_WEEK, label: t('one week ago')},
  {value: Interval.THIRTY_DAYS, label: t('30 days ago')},
];
