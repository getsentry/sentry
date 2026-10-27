import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

/** Full destination templates. Links normalize them only when rendered. */
export type SettingsBreadcrumb =
  | {label: string; to: string; type: 'link'}
  | {
      switchTo: string;
      to: string;
      type: 'team' | 'integration' | 'sentry-app';
    };

/** A breadcrumb entry for a route, including the project switcher. */
export type SettingsRouteBreadcrumb = SettingsBreadcrumb | {type: 'project'};

export type SettingsBreadcrumbItem = BreadcrumbListProps['items'][number];

export interface SettingsBreadcrumbSelectorProps {
  children: React.ReactNode;
  switchTo: string;
  to: string;
}
