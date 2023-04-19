import type {Color} from 'sentry/utils/theme';

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
}

interface BreadcrumbTypeBase {
  level: BreadcrumbLevelType;
  // it's recommended
  category?: string | null;
  event_id?: string | null;
  message?: string;
  messageFormat?: 'sql';
  messageRaw?: string;
  timestamp?: string;
}

export interface BreadcrumbTypeSystem extends BreadcrumbTypeBase {
  action: string;
  extras: Record<string, any>;
  type: BreadcrumbType.SYSTEM;
}

export interface BreadcrumbTypeSession extends BreadcrumbTypeBase {
  action: string;
  extras: Record<string, any>;
  type: BreadcrumbType.SESSION;
}

export interface BreadcrumbTypeNavigation extends BreadcrumbTypeBase {
  type: BreadcrumbType.NAVIGATION;
  data?: null | {
    from?: string;
    to?: string;
  };
}

export interface BreadcrumbTypeInit extends BreadcrumbTypeBase {
  data: {
    action: 'replay-init';
    label: string;
    url: string;
  };
  type: BreadcrumbType.INIT;
}

export interface BreadcrumbTypeHTTP extends BreadcrumbTypeBase {
  type: BreadcrumbType.HTTP;
  data?: null | {
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
  color: Color;
  description: string;
  id: number;
}

interface NavigationCrumb extends BaseCrumb, BreadcrumbTypeNavigation {}
interface HTTPCrumb extends BaseCrumb, BreadcrumbTypeHTTP {}
interface DefaultCrumb extends BaseCrumb, BreadcrumbTypeDefault {}

export type Crumb = NavigationCrumb | HTTPCrumb | DefaultCrumb;

export function isBreadcrumbLogLevel(logLevel: string): logLevel is BreadcrumbLevelType {
  return Object.values(BreadcrumbLevelType).includes(logLevel as any);
}

export function isBreadcrumbTypeDefault(
  breadcrumb: Crumb
): breadcrumb is Extract<Crumb, BreadcrumbTypeDefault> {
  return ![BreadcrumbType.HTTP, BreadcrumbType.NAVIGATION].includes(breadcrumb.type);
}
