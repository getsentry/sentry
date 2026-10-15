import {useContext} from 'react';

import {SettingsBreadcrumbsContext} from './context';
import type {SettingsBreadcrumbItem} from './types';

export function SettingsBreadcrumbItemProvider({
  item,
  children,
}: {
  children: React.ReactNode;
  item: SettingsBreadcrumbItem;
}) {
  const parents = useContext(SettingsBreadcrumbsContext);
  return (
    <SettingsBreadcrumbsContext value={[...parents, item]}>
      {children}
    </SettingsBreadcrumbsContext>
  );
}
