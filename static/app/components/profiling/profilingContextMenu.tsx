import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark} from 'sentry/icons';
import {space} from 'sentry/styles/space';

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
  min-width: 164px;
  overflow: auto;
  padding-bottom: ${space(0.5)};
`;

export {Menu as ProfilingContextMenu};

const MenuContentContainer = styled('div')`
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
    outline: none;
  }
`;

const MenuItemCheckboxLabel = styled('label')`
  display: flex;
  align-items: center;
  font-weight: normal;
  margin: 0;
  cursor: pointer;
  flex: 1 1 100%;
`;

interface MenuItemCheckboxProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  checked?: boolean;
}

const MenuItemCheckbox = forwardRef(
  (props: MenuItemCheckboxProps, ref: React.Ref<HTMLDivElement> | undefined) => {
    const {children, checked, ...rest} = props;

    return (
      <MenuContentOuterContainer>
        <MenuContentContainer ref={ref} role="menuitem" {...rest}>
          <MenuItemCheckboxLabel>
            <MenuLeadingItem>
              <Input type="checkbox" checked={checked} onChange={() => void 0} />
              <IconCheckmark />
            </MenuLeadingItem>
            <MenuContent>{children}</MenuContent>
          </MenuItemCheckboxLabel>
        </MenuContentContainer>
      </MenuContentOuterContainer>
    );
  }
);

export {MenuItemCheckbox as ProfilingContextMenuItemCheckbox};

interface MenuItemButtonProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  disabled?: boolean;
  icon?: React.ReactNode;
  tooltip?: string;
}

const MenuItemButton = forwardRef(
  (props: MenuItemButtonProps, ref: React.Ref<HTMLButtonElement> | undefined) => {
    const {children, tooltip, ...rest} = props;
    return (
      <MenuContentOuterContainer>
        <Tooltip title={tooltip}>
          <MenuButton disabled={props.disabled} ref={ref} role="menuitem" {...rest}>
            {props.icon ? <MenuLeadingItem>{props.icon}</MenuLeadingItem> : null}
            {children}
          </MenuButton>
        </Tooltip>
      </MenuContentOuterContainer>
    );
  }
);

export {MenuItemButton as ProfilingContextMenuItemButton};

const MenuButton = styled('button')`
  border: none;
  display: flex;
  flex: 1;
  align-items: center;
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  box-sizing: border-box;
  background: ${p => (p.tabIndex === 0 ? p.theme.hover : 'transparent')} !important;
  pointer-events: ${p => (p.disabled ? 'none' : undefined)};
  opacity: ${p => (p.disabled ? 0.7 : undefined)};

  &:focus {
    color: ${p => p.theme.textColor};
    background: ${p => p.theme.hover};
    outline: none;
  }

  svg {
    margin-right: ${space(0.5)};
  }
`;

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
      <MenuContentOuterContainer>
        <MenuContentContainer ref={ref} role="menuitem" {...rest}>
          <MenuContent>{children}</MenuContent>
        </MenuContentContainer>
      </MenuContentOuterContainer>
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

const MenuContentOuterContainer = styled('div')`
  padding: 0 ${space(0.5)};
  display: flex;

  > span {
    display: flex;
  }

  > div,
  > span,
  button {
    flex: 1;
  }
`;

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
