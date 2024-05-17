import {useState} from 'react';

import DropdownAutoCompleteMenu from 'sentry/components/dropdownAutoComplete/menu';
import type {Item} from 'sentry/components/dropdownAutoComplete/types';

import Crumb from './crumb';
import Divider from './divider';
import type {RouteWithName} from './types';

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
