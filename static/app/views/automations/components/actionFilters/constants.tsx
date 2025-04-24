import {t} from 'sentry/locale';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export const FILTER_MATCH_OPTIONS = [
  {value: DataConditionGroupLogicType.ALL, label: t('all')},
  {value: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT, label: t('any')},
  {value: DataConditionGroupLogicType.NONE, label: t('none')},
];

export const FILTER_DATA_CONDITION_TYPES = [
  DataConditionType.AGE_COMPARISON,
  DataConditionType.ISSUE_OCCURRENCES,
  DataConditionType.ASSIGNED_TO,
  DataConditionType.ISSUE_PRIORITY_EQUALS,
  DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
  DataConditionType.LATEST_ADOPTED_RELEASE,
  DataConditionType.LATEST_RELEASE,
  DataConditionType.EVENT_ATTRIBUTE,
  DataConditionType.TAGGED_EVENT,
  DataConditionType.LEVEL,
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

enum Assignee {
  UNASSIGNED = 'Unassigned',
  TEAM = 'Team',
  MEMBER = 'Member',
}

enum Priority {
  LOW = 25,
  MEDIUM = 50,
  HIGH = 75,
}

export enum AgeComparison {
  OLDER = 'older',
  NEWER = 'newer',
}

export enum ModelAge {
  OLDEST = 'oldest',
  NEWEST = 'newest',
}

export enum Attributes {
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

enum Level {
  FATAL = 50,
  ERROR = 40,
  WARNING = 30,
  INFO = 20,
  DEBUG = 10,
  SAMPLING = 0,
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

export const ASSIGNEE_CHOICES = [
  {value: Assignee.UNASSIGNED, label: t('unassigned')},
  {value: Assignee.MEMBER, label: t('member')},
  {value: Assignee.TEAM, label: t('team')},
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
  {value: MatchType.NOT_EQUAL, label: t('does not equal')},
];

export const LEVEL_CHOICES = [
  {value: Level.FATAL, label: t('fatal')},
  {value: Level.ERROR, label: t('error')},
  {value: Level.WARNING, label: t('warning')},
  {value: Level.INFO, label: t('info')},
  {value: Level.DEBUG, label: t('debug')},
  {value: Level.SAMPLING, label: t('sampling')},
];
