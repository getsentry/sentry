import {forwardRef, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {clamp} from 'sentry/utils/profiling/colors/utils';
import {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {Rect} from 'sentry/utils/profiling/gl/utils';

export function useContextMenu() {
  const [open, setOpen] = useState<boolean>(false);
  const itemProps = useKeyboardNavigation();

  function wrapSetOpen(newOpen: boolean) {
    if (!newOpen) {
      itemProps.setTabIndex(null);
    }
    setOpen(newOpen);
  }

  function getMenuProps() {
    const menuProps = itemProps.getMenuKeyboardEventHandlers();

    return {
      ...menuProps,
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (evt.key === 'Escape') {
          setOpen(false);
        }
        menuProps.onKeyDown(evt);
      },
    };
  }

  function getMenuItemProps() {
    const menuItemProps = itemProps.getMenuItemKeyboardEventHandlers();

    return {
      ...menuItemProps,
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (evt.key === 'Escape') {
          setOpen(false);
        }
        menuItemProps.onKeyDown(evt);
      },
    };
  }

  return {
    open,
    setOpen: wrapSetOpen,
    menuRef: itemProps.menuRef,
    getMenuProps,
    getMenuItemProps,
  };
}

function useKeyboardNavigation() {
  const [menuRef, setMenuRef] = useState<HTMLDivElement | null>(null);
  const [tabIndex, setTabIndex] = useState<number | null>(null);

  const items: {id: number; node: HTMLElement | null}[] = [];

  useEffect(() => {
    if (menuRef) {
      if (tabIndex === null) {
        menuRef.focus();
      }
    }
  }, [menuRef, tabIndex]);

  useEffect(() => {
    if (typeof tabIndex !== 'number') {
      return;
    }
    if (items[tabIndex]?.node) {
      items[tabIndex]?.node?.focus();
    }
  }, [tabIndex]);

  function getMenuKeyboardEventHandlers() {
    return {
      tabIndex: -1,
      ref: setMenuRef,
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (items.length === 0) {
          return;
        }

        if (evt.key === 'Escape') {
          setTabIndex(null);
        }

        if (evt.key === 'ArrowDown' || evt.key === 'Tab') {
          evt.preventDefault();

          if (tabIndex === items.length - 1 || tabIndex === null) {
            setTabIndex(0);
          } else {
            setTabIndex((tabIndex ?? 0) + 1);
          }
        }

        if (evt.key === 'ArrowUp' || (evt.key === 'Tab' && evt.shiftKey)) {
          evt.preventDefault();

          if (tabIndex === 0 || tabIndex === null) {
            setTabIndex(items.length - 1);
          } else {
            setTabIndex((tabIndex ?? 0) - 1);
          }
        }
      },
    };
  }

  function getMenuItemKeyboardEventHandlers() {
    const idx = items.length;
    items.push({id: idx, node: null});

    return {
      tabIndex: tabIndex === idx ? 0 : -1,
      ref: (node: HTMLElement | null) => {
        if (items[idx]) {
          items[idx].node = node;
        }
      },
      onMouseEnter: () => {
        setTabIndex(idx);
      },
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (items.length === 0) {
          return;
        }

        if (evt.key === 'Escape') {
          setTabIndex(null);
        }

        if (evt.key === 'Enter' || evt.key === ' ') {
          items?.[idx]?.node?.click?.();
        }

        if (evt.key === 'ArrowDown' || evt.key === 'Tab') {
          evt.preventDefault();

          if (tabIndex === items.length || tabIndex === null) {
            setTabIndex(0);
          } else {
            setTabIndex((tabIndex ?? 0) + 1);
          }
        }

        if (evt.key === 'ArrowUp' || (evt.key === 'Tab' && evt.shiftKey)) {
          evt.preventDefault();

          if (tabIndex === 0 || tabIndex === null) {
            setTabIndex(items.length);
          } else {
            setTabIndex((tabIndex ?? 0) - 1);
          }
        }
      },
    };
  }

  return {
    menuRef,
    getMenuItemKeyboardEventHandlers,
    getMenuKeyboardEventHandlers,
    tabIndex,
    setTabIndex,
  };
}

interface MenuProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  children: React.ReactNode;
}

const Menu = styled(
  forwardRef((props: MenuProps, ref: React.Ref<HTMLDivElement> | undefined) => {
    return <div ref={ref} role="menu" {...props} />;
  })
)`
  position: absolute;
  font-size: ${p => p.theme.fontSizeMedium};
  z-index: ${p => p.theme.zIndex.dropdown};
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  width: auto;
  overflow: auto;

  &:focus {
    outline: none;
  }
`;

interface MenuItemCheckboxProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  checked?: boolean;
}

const MenuLeadingItem = styled('div')`
  display: flex;
  align-items: center;
  height: 1.4em;
  width: 1em;
  gap: ${space(1)};
  padding: ${space(1)} 0;
  position: relative;
`;

const MenuContent = styled('div')`
  position: relative;
  width: 100%;
  display: flex;
  gap: ${space(0.5)};
  justify-content: space-between;
  padding: ${space(0.5)} 0;
  margin-left: ${space(0.5)};
  text-transform: capitalize;

  margin-bottom: 0;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Input = styled('input')`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  padding-right: ${space(1)};

  & + svg {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1em;
    height: 1.4em;
    display: none;
  }

  &:checked + svg {
    display: block;
  }
`;

const MenuItemCheckbox = styled(
  forwardRef(
    (props: MenuItemCheckboxProps, ref: React.Ref<HTMLDivElement> | undefined) => {
      const {children, checked, className, style, ...rest} = props;

      return (
        // @ts-ignore this ref is forwarded
        <MenuItem ref={ref} {...rest}>
          <label className={className} style={style}>
            <MenuLeadingItem>
              <Input type="checkbox" checked={checked} onChange={() => void 0} />
              <IconCheckmark />
            </MenuLeadingItem>
            <MenuContent>{children}</MenuContent>
          </label>
        </MenuItem>
      );
    }
  )
)`
  cursor: pointer;
  display: flex;
  align-items: center;
  font-weight: normal;
  padding: 0 ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  box-sizing: border-box;
  background: ${p => (p.tabIndex === 0 ? p.theme.hover : undefined)};

  &:focus {
    color: ${p => p.theme.textColor};
    background: ${p => p.theme.hover};
  }
`;

interface MenuItemProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  children: React.ReactNode;
}

const MenuItem = styled(
  forwardRef((props: MenuItemProps, ref: React.Ref<HTMLDivElement> | undefined) => {
    const {children, ...rest} = props;
    return (
      <div ref={ref} role="menuitem" {...rest}>
        {children}
      </div>
    );
  })
)`
  cursor: pointer;
  color: ${p => p.theme.textColor};
  background: transparent;
  padding: 0 ${space(0.5)};

  &:focus {
    outline: none;
  }

  &:active: {
    background: transparent;
  }
`;

const MenuGroup = styled('div')`
  padding-top: 0;
  padding-bottom: ${space(1)};

  &:last-of-type {
    padding-bottom: 0;
  }
`;

interface MenuHeadingProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  children: React.ReactNode;
}

const MenuHeading = styled((props: MenuHeadingProps) => {
  const {children, ...rest} = props;
  return <div {...rest}>{children}</div>;
})`
  text-transform: uppercase;
  line-height: 1.5;
  font-weight: 600;
  color: ${p => p.theme.subText};
  margin-bottom: 0;
  cursor: default;
  font-size: 75%;
  padding: ${space(0.5)} ${space(1.5)};
`;

const Layer = styled('div')`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  z-index: ${p => p.theme.zIndex.dropdown - 1};
`;

const FLAMEGRAPH_COLOR_CODINGS: FlamegraphColorCodings = [
  'by symbol name',
  'by system / application',
  'by library',
  'by recursion',
];
const FLAMEGRAPH_VIEW_OPTIONS: FlamegraphViewOptions = ['top down', 'bottom up'];
const FLAMEGRAPH_SORTING_OPTIONS: FlamegraphSorting = ['left heavy', 'call order'];
const FLAMEGRAPH_AXIS_OPTIONS: FlamegraphAxisOptions = ['standalone', 'transaction'];

function computeBestContextMenuPosition(mouse: Rect, container: Rect, target: Rect) {
  const maxY = Math.floor(container.height - target.height);
  const minY = container.top;

  const minX = container.left;
  const maxX = Math.floor(container.right - target.width);

  // We add a tiny offset so that the menu is not directly where the user places their cursor.
  const OFFSET = 6;

  return {
    left: clamp(mouse.x + OFFSET, minX, maxX),
    top: clamp(mouse.y + OFFSET, minY, maxY),
  };
}

interface FlameGraphOptionsContextMenuProps {
  container: HTMLElement | null;
  contextMenuCoordinates: Rect | null;
  contextMenuProps: ReturnType<typeof useContextMenu>;
}

export function FlamegraphOptionsContextMenu(props: FlameGraphOptionsContextMenuProps) {
  const [containerCoordinates, setContainerCoordinates] = useState<Rect | null>(null);
  const [menuCoordinates, setMenuCoordinates] = useState<Rect | null>(null);
  const {open, setOpen, menuRef, getMenuProps, getMenuItemProps} = props.contextMenuProps;

  const [preferences, dispatch] = useFlamegraphPreferences();

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!menuRef || menuRef.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [menuRef, setOpen]);

  // Observe the menu
  useEffect(() => {
    if (!menuRef) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setMenuCoordinates(new Rect(0, 0, contentRect.width, contentRect.height));
    });

    resizeObserver.observe(menuRef);

    return () => {
      resizeObserver.disconnect();
    };
  }, [menuRef]);

  // Observe the container
  useEffect(() => {
    if (!props.container) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setContainerCoordinates(new Rect(0, 0, contentRect.width, contentRect.height));
    });

    resizeObserver.observe(props.container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [props.container]);

  const position =
    props.contextMenuCoordinates && containerCoordinates && menuCoordinates
      ? computeBestContextMenuPosition(
          props.contextMenuCoordinates,
          containerCoordinates,
          menuCoordinates
        )
      : null;

  return (
    <Fragment>
      {open ? (
        <Layer
          onClick={() => {
            setOpen(false);
          }}
        />
      ) : null}
      {props.contextMenuCoordinates ? (
        <Menu
          {...getMenuProps()}
          style={{
            position: 'absolute',
            visibility: open ? 'initial' : 'hidden',
            left: position?.left ?? -9999,
            top: position?.top ?? -9999,
            pointerEvents: open ? 'initial' : 'none',
            maxHeight: containerCoordinates?.height ?? 'auto',
          }}
        >
          <MenuGroup>
            <MenuHeading>{t('Color Coding')}</MenuHeading>
            {FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (
              <MenuItemCheckbox
                key={idx}
                {...getMenuItemProps()}
                onClick={() => dispatch({type: 'set color coding', payload: coding})}
                checked={preferences.colorCoding === coding}
              >
                {coding}
              </MenuItemCheckbox>
            ))}
          </MenuGroup>
          <MenuGroup>
            <MenuHeading>{t('View')}</MenuHeading>
            {FLAMEGRAPH_VIEW_OPTIONS.map((view, idx) => (
              <MenuItemCheckbox
                key={idx}
                {...getMenuItemProps()}
                onClick={() => dispatch({type: 'set view', payload: view})}
                checked={preferences.view === view}
              >
                {view}
              </MenuItemCheckbox>
            ))}
          </MenuGroup>
          <MenuGroup>
            <MenuHeading>{t('Sorting')}</MenuHeading>
            {FLAMEGRAPH_SORTING_OPTIONS.map((sorting, idx) => (
              <MenuItemCheckbox
                key={idx}
                {...getMenuItemProps()}
                onClick={() => dispatch({type: 'set sorting', payload: sorting})}
                checked={preferences.sorting === sorting}
              >
                {sorting}
              </MenuItemCheckbox>
            ))}
          </MenuGroup>
          <MenuGroup>
            <MenuHeading>{t('X Axis')}</MenuHeading>
            {FLAMEGRAPH_AXIS_OPTIONS.map((axis, idx) => (
              <MenuItemCheckbox
                key={idx}
                {...getMenuItemProps()}
                onClick={() => dispatch({type: 'set xAxis', payload: axis})}
                checked={preferences.xAxis === axis}
              >
                {axis}
              </MenuItemCheckbox>
            ))}
          </MenuGroup>
        </Menu>
      ) : null}
    </Fragment>
  );
}
