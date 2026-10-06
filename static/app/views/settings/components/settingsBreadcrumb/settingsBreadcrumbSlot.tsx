import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import type {LinkProps} from '@sentry/scraps/link';

import {TopBar} from 'sentry/views/navigation/topBar';

import type {SettingsBreadcrumbProps} from './types';

type SelectItem = Extract<BreadcrumbListProps['items'][number], {type: 'select'}>;

type Props = Pick<SettingsBreadcrumbProps, 'items' | 'itemIndex' | 'title'> &
  Omit<SelectItem, 'type' | 'onChange' | 'label'> & {
    hasMenu: boolean;
    label: string;
    onCrumbSelect: (value: string) => void;
    to: LinkProps['to'];
  };

export function SettingsBreadcrumbSlot({
  items,
  itemIndex,
  title,
  label,
  leadingGraphic,
  to,
  hasMenu,
  onCrumbSelect,
  ...selectProps
}: Props) {
  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={title}
      items={[
        ...items.slice(0, itemIndex),
        hasMenu
          ? {
              type: 'select',
              label,
              leadingGraphic,
              ...selectProps,
              onChange: selected => onCrumbSelect(selected.value),
            }
          : {type: 'link', label, leadingGraphic, to},
        ...items.slice(itemIndex),
      ]}
    />
  );
}
