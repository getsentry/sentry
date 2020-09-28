import {Color} from 'app/utils/theme';
import SvgIcon from 'app/icons/svgIcon';

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
}

type BreadcrumbTypeBase = {
  level: BreadcrumbLevelType;
  timestamp?: string; //it's recommended
  category?: string | null;
  message?: string;
  event_id?: string;
};

export type BreadcrumbTypeSystem = {
  type: BreadcrumbType.SYSTEM;
  action: string;
  extras: Record<string, any>;
} & BreadcrumbTypeBase;

export type BreadcrumbTypeSession = {
  type: BreadcrumbType.SESSION;
  action: string;
  extras: Record<string, any>;
} & BreadcrumbTypeBase;

export type BreadcrumbTypeNavigation = {
  type: BreadcrumbType.NAVIGATION;
  data?: {
    to?: string;
    from?: string;
  };
} & BreadcrumbTypeBase;

export type BreadcrumbTypeHTTP = {
  type: BreadcrumbType.HTTP;
  data?: {
    url?: string;
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
    status_code?: number;
    reason?: string;
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
    | BreadcrumbType.SESSION
    | BreadcrumbType.SYSTEM
    | BreadcrumbType.SESSION
    | BreadcrumbType.TRANSACTION;
  data?: {[key: string]: any};
} & BreadcrumbTypeBase;

export type Breadcrumb =
  | BreadcrumbTypeNavigation
  | BreadcrumbTypeHTTP
  | BreadcrumbTypeDefault;

type BreadcrumbDetails = {
  color?: Color | React.CSSProperties['color'];
  icon?: React.ComponentType<IconProps>;
  description: string;
};

export type BreadcrumbsWithDetails = Array<Breadcrumb & BreadcrumbDetails & {id: number}>;
