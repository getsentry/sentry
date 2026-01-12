import type {SVGIconProps} from 'sentry/icons/svgIcon';

export enum BreadcrumbLevelType {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug',
  UNDEFINED = 'undefined',
  LOG = 'log',
}

export enum BreadcrumbType {
  INFO = 'info',
  DEBUG = 'debug',
  MESSAGE = 'message',
  QUERY = 'query',
  UI = 'ui',
  USER = 'user',
  EXCEPTION = 'exception',
  WARNING = 'warning',
  ERROR = 'error',
  DEFAULT = 'default',
  HTTP = 'http',
  NAVIGATION = 'navigation',
  SYSTEM = 'system',
  SESSION = 'session',
  TRANSACTION = 'transaction',
  INIT = 'init',
  NETWORK = 'network',
  DEVICE = 'device',
  CONNECTIVITY = 'connectivity',
}

export enum BreadcrumbMessageFormat {
  SQL = 'sql',
}

interface BreadcrumbTypeBase {
  level: BreadcrumbLevelType;
  // it's recommended
  category?: string | null;
  event_id?: string | null;
  message?: string;
  messageFormat?: BreadcrumbMessageFormat.SQL;
  messageRaw?: string;
  timestamp?: string;
}

export interface BreadcrumbTypeNavigation extends BreadcrumbTypeBase {
  type: BreadcrumbType.NAVIGATION;
  data?: null | {
    from?: string;
    to?: string;
  };
}

export interface BreadcrumbTypeHTTP extends BreadcrumbTypeBase {
  type: BreadcrumbType.HTTP;
  data?:
    | null
    | Record<string, any>
    // Though this is the expected type, more data can be attached to these crumbs
    | {
        method?:
          | 'POST'
          | 'PUT'
          | 'GET'
          | 'HEAD'
          | 'DELETE'
          | 'CONNECT'
          | 'OPTIONS'
          | 'TRACE'
          | 'PATCH';
        reason?: string;
        status_code?: number;
        url?: string;
      };
}

export interface BreadcrumbTypeDefault extends BreadcrumbTypeBase {
  type:
    | BreadcrumbType.INFO
    | BreadcrumbType.DEBUG
    | BreadcrumbType.QUERY
    | BreadcrumbType.UI
    | BreadcrumbType.USER
    | BreadcrumbType.EXCEPTION
    | BreadcrumbType.WARNING
    | BreadcrumbType.ERROR
    | BreadcrumbType.DEFAULT
    | BreadcrumbType.INIT
    | BreadcrumbType.SESSION
    | BreadcrumbType.SYSTEM
    | BreadcrumbType.TRANSACTION;
  data?: Record<string, any> | null;
}

export type RawCrumb =
  | BreadcrumbTypeNavigation
  | BreadcrumbTypeHTTP
  | BreadcrumbTypeDefault;

interface BaseCrumb {
  // This should not exist on the type and should instead live where the icon is used.
  description: string;
  id: number;
  variant: NonNullable<SVGIconProps['variant']>;
}

interface NavigationCrumb extends BaseCrumb, BreadcrumbTypeNavigation {}
interface HTTPCrumb extends BaseCrumb, BreadcrumbTypeHTTP {}
interface DefaultCrumb extends BaseCrumb, BreadcrumbTypeDefault {}

export type Crumb = NavigationCrumb | HTTPCrumb | DefaultCrumb;
