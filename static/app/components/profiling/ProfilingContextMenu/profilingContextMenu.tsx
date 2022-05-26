import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons';
import space from 'sentry/styles/space';

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

export {Menu as ProfilingContextMenu};

interface MenuItemCheckboxProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  checked?: boolean;
}

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

export {MenuItemCheckbox as ProfilingContextMenuItemCheckbox};

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

export {MenuItem as ProfilingContextMenuItem};

const MenuGroup = styled('div')`
  padding-top: 0;
  padding-bottom: ${space(1)};

  &:last-of-type {
    padding-bottom: 0;
  }
`;

export {MenuGroup as ProfilingContextMenuGroup};

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

export {MenuHeading as ProfilingContextMenuHeading};

const Layer = styled('div')`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  z-index: ${p => p.theme.zIndex.dropdown - 1};
`;

export {Layer as ProfilingContextMenuLayer};
