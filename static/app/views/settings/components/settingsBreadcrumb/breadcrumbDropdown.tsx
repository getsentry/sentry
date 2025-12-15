import {useCallback, useContext, useEffect, useRef} from 'react';
import {useHover} from '@react-aria/interactions';
import {type OverlayTriggerState} from '@react-stately/overlays';

import {
  CompactSelect,
  type SingleSelectProps,
} from 'sentry/components/core/compactSelect';
import {SelectContext} from 'sentry/components/core/compactSelect/control';

import Crumb from './crumb';
import Divider from './divider';
import type {RouteWithName} from './types';

interface BreadcrumbDropdownProps
  extends Omit<SingleSelectProps<string>, 'onChange' | 'clearable'> {
  name: React.ReactNode;
  onCrumbSelect: (value: string) => void;
  route: RouteWithName;
  hasMenu?: boolean;
  isLast?: boolean;
}

function BreadcrumbDropdown({
  hasMenu,
  route,
  isLast,
  name,
  onCrumbSelect,
  options,
  value,
  ...props
}: BreadcrumbDropdownProps) {
  const {
    hoverProps: {onPointerEnter, onPointerLeave},
    isHovered,
  } = useHover({});

  if (!hasMenu) {
    return (
      <Crumb>
        <span>{name || route.name} </span>
        {isLast ? null : <Divider />}
      </Crumb>
    );
  }

  return (
    <CompactSelect
      searchable
      options={options.map(item => ({...item, hideCheck: true}))}
      onChange={selected => {
        onCrumbSelect(selected.value);
      }}
      closeOnSelect
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      value={value}
      trigger={triggerProps => (
        <MenuCrumb
          crumbLabel={name || route.name}
          menuHasHover={isHovered}
          {...triggerProps}
          // @ts-expect-error - TODO: Crumb component should be refactored to use a button element instead of a div
          ref={triggerProps.ref}
        />
      )}
      {...props}
    />
  );
}

interface MenuCrumbProps extends React.ComponentProps<typeof Crumb> {
  crumbLabel: React.ReactNode;
  menuHasHover: boolean;
  isLast?: boolean;
}

// XXX(epurkhiser): We have a couple hacks in place to get hover-activation of
// our CompactSelect working well for these breadcrumbs.
//
// 1. We're using the SelectContext to retrieve the OverlayTriggerState object
//    for the CompactSelect that will be rendered upon hover. We need this so
//    we can activate the menu. Using the `isOpen` controlled prop on
//    CompactSelect does not work since it will not actually focus the menu.
//
// 2. We track the active crumb OverlayTriggerState objects so that when
//    activating a second crumb the first one can be immediately closed,
//    instead of being closed after the PointerLeave timemout.
const activeCrumbStates = new Set<OverlayTriggerState | undefined>();

const CLOSE_MENU_TIMEOUT = 250;

function MenuCrumb({crumbLabel, menuHasHover, isLast, ...props}: MenuCrumbProps) {
  const {overlayState, overlayIsOpen} = useContext(SelectContext);
  const {open, close} = overlayState ?? {};

  const closeTimeoutRef = useRef<number>(undefined);

  useEffect(() => {
    activeCrumbStates.add(overlayState);
    return () => void activeCrumbStates.delete(overlayState);
  }, [overlayState]);

  const queueMenuClose = useCallback(() => {
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => close?.(), CLOSE_MENU_TIMEOUT);
  }, [close]);

  const handleOpen = useCallback(() => {
    activeCrumbStates.forEach(state => state?.close());
    window.clearTimeout(closeTimeoutRef.current);
    open?.();
  }, [open]);

  useEffect(() => {
    if (menuHasHover) {
      window.clearTimeout(closeTimeoutRef.current);
    } else {
      queueMenuClose();
    }
  }, [menuHasHover, queueMenuClose]);

  return (
    <Crumb {...props} onPointerEnter={handleOpen} onPointerLeave={queueMenuClose}>
      <span>{crumbLabel} </span>
      {isLast ? null : <Divider isHover={overlayIsOpen} />}
    </Crumb>
  );
}

export default BreadcrumbDropdown;
