import type SvgIcon from 'sentry/icons/svgIcon';
import type {Color} from 'sentry/utils/theme';

export type IconProps = React.ComponentProps<typeof SvgIcon>;

export enum BreadcrumbLevelType {
  FATAL = 'fatal',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug',
  UNDEFINED = 'undefined',
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

type BreadcrumbTypeBase = {
  level: BreadcrumbLevelType;
  // it's recommended
  category?: string | null;
  event_id?: string | null;
  message?: string;
  timestamp?: string;
};

export type BreadcrumbTypeSystem = {
  action: string;
  extras: Record<string, any>;
  type: BreadcrumbType.SYSTEM;
} & BreadcrumbTypeBase;

export type BreadcrumbTypeSession = {
  action: string;
  extras: Record<string, any>;
  type: BreadcrumbType.SESSION;
} & BreadcrumbTypeBase;

export type BreadcrumbTypeNavigation = {
  type: BreadcrumbType.NAVIGATION;
  data?: {
    from?: string;
    to?: string;
  };
} & BreadcrumbTypeBase;

export type BreadcrumbTypeHTTP = {
  type: BreadcrumbType.HTTP;
  data?: {
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
} & BreadcrumbTypeBase;

export type BreadcrumbTypeDefault = {
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
  data?: Record<string, any>;
} & BreadcrumbTypeBase;

export type RawCrumb =
  | BreadcrumbTypeNavigation
  | BreadcrumbTypeHTTP
  | BreadcrumbTypeDefault;

export type Crumb = RawCrumb & {
  color: Color;
  description: string;
  id: number;
};

export function isBreadcrumbTypeDefault(
  breadcrumb: RawCrumb
): breadcrumb is BreadcrumbTypeDefault {
  return ![BreadcrumbType.HTTP, BreadcrumbType.NAVIGATION].includes(breadcrumb.type);
}
