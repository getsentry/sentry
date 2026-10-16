import {Fragment, useState} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Container} from '@sentry/scraps/layout';
import {
  MenuListItem,
  type MenuListItemProps as BaseMenuListItemProps,
} from '@sentry/scraps/menuListItem';

import {useMenuContext} from './context';
import {useSectionItemVisibility} from './section';

export interface MenuListItemProps extends Omit<BaseMenuListItemProps, 'label'> {
  label: React.ReactNode;
  closeOnSelect?: boolean;
  onAction?: () => void;
  textValue?: string;
}

export interface MenuCheckboxItemProps extends Omit<
  MenuListItemProps,
  'closeOnSelect' | 'onAction'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function isMenuItemHidden(
  search: string,
  label: React.ReactNode,
  textValue?: string
) {
  const text = textValue ?? (typeof label === 'string' ? label : '');
  return Boolean(
    search && !text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
}

interface BaseMenuItemProps extends MenuListItemProps {
  checked?: boolean;
  role?: 'menuitem' | 'menuitemcheckbox';
}

function BaseMenuItem({
  label,
  textValue,
  onAction,
  closeOnSelect = true,
  disabled,
  checked,
  role = 'menuitem',
  ...props
}: BaseMenuItemProps) {
  const {search, close} = useMenuContext();
  const [isFocused, setFocused] = useState(false);
  const hidden = isMenuItemHidden(search, label, textValue);
  useSectionItemVisibility(!hidden);

  return (
    <Container
      as="li"
      display={hidden ? 'none' : 'block'}
      role="presentation"
      hidden={hidden}
    >
      <MenuListItem
        as="div"
        {...props}
        label={label}
        disabled={disabled}
        isFocused={isFocused}
        isSelected={checked}
        innerWrapProps={{
          role,
          tabIndex: disabled ? undefined : -1,
          'aria-disabled': disabled || undefined,
          'aria-checked': role === 'menuitemcheckbox' ? checked : undefined,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onClick: () => {
            if (disabled) {
              return;
            }
            onAction?.();
            if (closeOnSelect) {
              close();
            }
          },
          onKeyDown: event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.currentTarget.click();
            }
          },
        }}
      />
    </Container>
  );
}

export function MenuItem(props: MenuListItemProps) {
  return <BaseMenuItem {...props} />;
}

export function MenuCheckboxItem({
  checked,
  onChange,
  leadingItems,
  ...props
}: MenuCheckboxItemProps) {
  return (
    <BaseMenuItem
      {...props}
      role="menuitemcheckbox"
      checked={checked}
      closeOnSelect={false}
      onAction={() => onChange(!checked)}
      leadingItems={state => (
        <Fragment>
          <Container width="1em">
            {checked && <IconCheckmark size="xs" aria-hidden="true" />}
          </Container>
          {typeof leadingItems === 'function' ? leadingItems(state) : leadingItems}
        </Fragment>
      )}
    />
  );
}
