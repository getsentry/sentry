import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

/** Full destination templates. Links normalize them only when rendered. */
export type SettingsBreadcrumb =
  | {label: string; to: string; type: 'link'}
  | {
      switchTo: string;
      to: string;
      type: 'project' | 'team' | 'integration' | 'sentry-app';
    };

export type SettingsBreadcrumbItem = BreadcrumbListProps['items'][number];

export interface SettingsBreadcrumbSelectorProps {
  children: React.ReactNode;
  switchTo: string;
  to: string;
}
