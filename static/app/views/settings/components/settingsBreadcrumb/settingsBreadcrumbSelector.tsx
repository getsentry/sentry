import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import type {LinkProps} from '@sentry/scraps/link';

import {SettingsBreadcrumbItemProvider} from './settingsBreadcrumbItemProvider';

type SelectItem = Extract<BreadcrumbListProps['items'][number], {type: 'select'}>;

type Props = Omit<SelectItem, 'type' | 'onChange' | 'label'> & {
  children: React.ReactNode;
  hasMenu: boolean;
  label: string;
  onCrumbSelect: (value: string) => void;
  to: LinkProps['to'];
};

export function SettingsBreadcrumbSelector({
  children,
  label,
  leadingGraphic,
  to,
  hasMenu,
  onCrumbSelect,
  ...selectProps
}: Props) {
  return (
    <SettingsBreadcrumbItemProvider
      item={
        hasMenu
          ? {
              type: 'select',
              label,
              leadingGraphic,
              ...selectProps,
              onChange: selected => onCrumbSelect(selected.value),
            }
          : {type: 'link', label, leadingGraphic, to}
      }
    >
      {children}
    </SettingsBreadcrumbItemProvider>
  );
}
