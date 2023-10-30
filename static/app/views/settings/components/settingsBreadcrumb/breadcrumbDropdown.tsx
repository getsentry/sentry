import {useState} from 'react';

import DropdownAutoCompleteMenu from 'sentry/components/dropdownAutoComplete/menu';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import Crumb from 'sentry/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'sentry/views/settings/components/settingsBreadcrumb/divider';

import {RouteWithName} from './types';

interface AdditionalDropdownProps
  extends Pick<
    React.ComponentProps<typeof DropdownAutoCompleteMenu>,
    'onChange' | 'busyItemsStillVisible'
  > {}

export interface BreadcrumbDropdownProps extends AdditionalDropdownProps {
  items: Item[];
  name: React.ReactNode;
  onSelect: (item: Item) => void;
  route: RouteWithName;
  hasMenu?: boolean;
  isLast?: boolean;
}

function BreadcrumbDropdown({
  hasMenu,
  route,
  isLast,
  name,
  onSelect,
  ...dropdownProps
}: BreadcrumbDropdownProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <DropdownAutoCompleteMenu
      blendCorner={false}
      isOpen={isActive}
      virtualizedHeight={41}
      onSelect={item => {
        setIsActive(false);
        onSelect(item);
      }}
      menuProps={{
        onMouseEnter: () => setIsActive(true),
        onMouseLeave: () => setIsActive(false),
      }}
      {...dropdownProps}
    >
      {({getActorProps, isOpen}) => (
        <Crumb
          {...getActorProps({
            onClick: () => setIsActive(false),
            onMouseEnter: () => setIsActive(true),
            onMouseLeave: () => setIsActive(false),
          })}
        >
          <span>{name || route.name} </span>
          <Divider isHover={hasMenu && isOpen} isLast={isLast} />
        </Crumb>
      )}
    </DropdownAutoCompleteMenu>
  );
}

export default BreadcrumbDropdown;
