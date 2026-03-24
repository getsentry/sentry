import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {IconCheckmark} from 'sentry/icons';

interface MenuProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

const Menu = styled(({ref, ...props}: MenuProps) => {
  return <div ref={ref} role="menu" {...props} />;
})`
  position: absolute;
  font-size: ${p => p.theme.font.size.md};
  z-index: ${p => p.theme.zIndex.dropdown};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  width: auto;
  min-width: 164px;
  overflow: auto;
  padding-bottom: ${p => p.theme.space.xs};
`;

export {Menu as ProfilingContextMenu};

const MenuContentContainer = styled('div')`
  cursor: pointer;
  display: flex;
  align-items: center;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  padding: 0 ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  box-sizing: border-box;
  background: ${p =>
    p.tabIndex === 0
      ? p.theme.tokens.interactive.transparent.neutral.background.active
      : undefined};

  &:focus {
    color: ${p => p.theme.tokens.content.primary};
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
    outline: none;
  }
`;

const MenuItemCheckboxLabel = styled('label')`
  display: flex;
  align-items: center;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  margin: 0;
  cursor: pointer;
  flex: 1 1 100%;
`;

interface MenuItemCheckboxProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  checked?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

function MenuItemCheckbox({ref, ...props}: MenuItemCheckboxProps) {
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

export {MenuItemCheckbox as ProfilingContextMenuItemCheckbox};

interface MenuItemButtonProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> {
  disabled?: boolean;
  icon?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  tooltip?: string;
}

function MenuItemButton({ref, ...props}: MenuItemButtonProps) {
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

export {MenuItemButton as ProfilingContextMenuItemButton};

const MenuButton = styled('button')`
  border: none;
  display: flex;
  flex: 1;
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  box-sizing: border-box;
  background: ${p =>
    p.tabIndex === 0
      ? p.theme.tokens.interactive.transparent.neutral.background.active
      : 'transparent'} !important;
  pointer-events: ${p => (p.disabled ? 'none' : undefined)};
  opacity: ${p => (p.disabled ? 0.7 : undefined)};

  &:focus {
    color: ${p => p.theme.tokens.content.primary};
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
    outline: none;
  }

  svg {
    margin-right: ${p => p.theme.space.xs};
  }
`;

const MenuLeadingItem = styled('div')`
  display: flex;
  align-items: center;
  height: 1.4em;
  width: 1em;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} 0;
  position: relative;
`;

const MenuContent = styled('div')`
  position: relative;
  width: 100%;
  display: flex;
  gap: ${p => p.theme.space.xs};
  justify-content: space-between;
  padding: ${p => p.theme.space.xs} 0;
  margin-left: ${p => p.theme.space.xs};
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
  padding-right: ${p => p.theme.space.md};

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

interface MenuItemProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

const MenuItem = styled(({ref, ...props}: MenuItemProps) => {
  const {children, ...rest} = props;
  return (
    <MenuContentOuterContainer>
      <MenuContentContainer ref={ref} role="menuitem" {...rest}>
        <MenuContent>{children}</MenuContent>
      </MenuContentContainer>
    </MenuContentOuterContainer>
  );
})`
  cursor: pointer;
  color: ${p => p.theme.tokens.content.primary};
  background: transparent;
  padding: 0 ${p => p.theme.space.xs};

  &:focus {
    outline: none;
  }

  &:active: {
    background: transparent;
  }
`;

export {MenuItem as ProfilingContextMenuItem};

const MenuContentOuterContainer = styled('div')`
  padding: 0 ${p => p.theme.space.xs};
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
  padding-bottom: ${p => p.theme.space.md};

  &:last-of-type {
    padding-bottom: 0;
  }
`;

export {MenuGroup as ProfilingContextMenuGroup};

interface MenuHeadingProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  children: React.ReactNode;
}

const MenuHeading = styled((props: MenuHeadingProps) => {
  const {children, ...rest} = props;
  return <div {...rest}>{children}</div>;
})`
  text-transform: uppercase;
  line-height: 1.5;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
  margin-bottom: 0;
  cursor: default;
  font-size: 75%;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
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
