import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface MenuProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

const Menu = styled(({ref, ...props}: MenuProps) => {
  return <div ref={ref} role="menu" {...props} />;
})`
  position: absolute;
  font-size: ${p => p.theme.fontSize.md};
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
  font-weight: ${p => p.theme.fontWeight.normal};
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
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
  cursor: pointer;
  flex: 1 1 100%;
`;

interface MenuItemCheckboxProps
  extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  checked?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

function MenuItemCheckbox({ref, ...props}: MenuItemCheckboxProps) {
  const {children, checked, ...rest} = props;

  return (
    <MenuContentOuterContainer>
      <Flex>
        <MenuContentContainer ref={ref} role="menuitem" {...rest}>
          <Flex align="center">
            <MenuItemCheckboxLabel>
              <Flex align="center">
                <MenuLeadingItemWrapper>
                  <Flex align="center" gap="sm">
                    <Input type="checkbox" checked={checked} onChange={() => void 0} />
                    <IconCheckmark />
                  </Flex>
                </MenuLeadingItemWrapper>
                <MenuContentWrapper>
                  <Flex gap="xs" justify="between">
                    {children}
                  </Flex>
                </MenuContentWrapper>
              </Flex>
            </MenuItemCheckboxLabel>
          </Flex>
        </MenuContentContainer>
      </Flex>
    </MenuContentOuterContainer>
  );
}

export {MenuItemCheckbox as ProfilingContextMenuItemCheckbox};

interface MenuItemButtonProps
  extends React.DetailedHTMLProps<
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
      <Flex>
        <Tooltip title={tooltip}>
          <MenuButton disabled={props.disabled} ref={ref} role="menuitem" {...rest}>
            <Flex align="center">
              {props.icon ? (
                <MenuLeadingItemWrapper>
                  <Flex align="center" gap="sm">
                    {props.icon}
                  </Flex>
                </MenuLeadingItemWrapper>
              ) : null}
              {children}
            </Flex>
          </MenuButton>
        </Tooltip>
      </Flex>
    </MenuContentOuterContainer>
  );
}

export {MenuItemButton as ProfilingContextMenuItemButton};

const MenuButton = styled('button')`
  border: none;
  flex: 1;
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

const MenuLeadingItemWrapper = styled('div')`
  height: 1.4em;
  width: 1em;
  padding: ${space(1)} 0;
  position: relative;
`;

const MenuContentWrapper = styled('div')`
  position: relative;
  width: 100%;
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
  ref?: React.Ref<HTMLDivElement>;
}

const MenuItem = styled(({ref, ...props}: MenuItemProps) => {
  const {children, ...rest} = props;
  return (
    <MenuContentOuterContainer>
      <Flex>
        <MenuContentContainer ref={ref} role="menuitem" {...rest}>
          <Flex align="center">
            <MenuContentWrapper>
              <Flex gap="xs" justify="between">
                {children}
              </Flex>
            </MenuContentWrapper>
          </Flex>
        </MenuContentContainer>
      </Flex>
    </MenuContentOuterContainer>
  );
})`
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
  font-weight: ${p => p.theme.fontWeight.bold};
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
