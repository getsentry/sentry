import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';

import type {SidebarItemProps} from './sidebarItem';
import SidebarItem, {isItemActive} from './sidebarItem';

type SidebarAccordionProps = SidebarItemProps & {
  children?: React.ReactNode;
};

export const ExpandedContext = createContext<{
  openMainItemId: string | null;
  setOpenMainItem: (mainItemId: string | null) => void;
}>({
  openMainItemId: null,
  setOpenMainItem: () => {},
});

export function ExpandedContextProvider(props) {
  const [openMainItemId, setOpenMainItem] = useState<string | null>(null);

  return (
    <ExpandedContext.Provider value={{openMainItemId, setOpenMainItem}}>
      {props.children}
    </ExpandedContext.Provider>
  );
}

function SidebarAccordion({children, ...itemProps}: SidebarAccordionProps) {
  const {id, collapsed: sidebarCollapsed} = itemProps;
  const accoridonRef = useRef<HTMLDivElement>(null);
  const {openMainItemId, setOpenMainItem} = useContext(ExpandedContext);
  const theme = useTheme();
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const [expanded, setExpanded] = useLocalStorageState(
    `sidebar-accordion-${id}:expanded`,
    true
  );

  const mainItemId = `sidebar-accordion-${id}-item`;
  const contentId = `sidebar-accordion-${id}-content`;
  const isOpenInFloatingSidebar = openMainItemId === mainItemId;

  const isActive = isItemActive(itemProps);

  const childSidebarItems = findChildElementsInTree(children, 'SidebarItem');

  const hasActiveChildren = Children.toArray(childSidebarItems).some(child => {
    if (isValidElement(child)) {
      return isItemActive(child.props);
    }

    return false;
  });

  const handleExpandAccordionClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setExpanded(!expanded);
    },
    [expanded, setExpanded]
  );

  const handleMainItemClick = (
    _: string,
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => {
    if ((!horizontal && !sidebarCollapsed) || !children) {
      setOpenMainItem(null);
      return;
    }

    e.preventDefault();
    if (isOpenInFloatingSidebar) {
      setOpenMainItem(null);
    } else {
      setOpenMainItem(mainItemId);
    }
  };

  return (
    <SidebarAccordionWrapper ref={accoridonRef}>
      <SidebarAccordionHeaderWrap>
        <SidebarItem
          {...itemProps}
          active={isActive && !hasActiveChildren}
          id={mainItemId}
          aria-expanded={expanded}
          aria-owns={contentId}
          onClick={handleMainItemClick}
          trailingItems={
            <SidebarAccordionExpandButton
              size="zero"
              borderless
              onClick={handleExpandAccordionClick}
              aria-controls={mainItemId}
              aria-label={expanded ? t('Collapse') : t('Expand')}
              sidebarCollapsed={sidebarCollapsed}
            >
              <IconChevron
                size="xs"
                direction={expanded ? 'up' : 'down'}
                role="presentation"
              />
            </SidebarAccordionExpandButton>
          }
        />
      </SidebarAccordionHeaderWrap>
      {expanded && !horizontal && !sidebarCollapsed && (
        <SidebarAccordionSubitemsWrap id={contentId}>
          {children}
        </SidebarAccordionSubitemsWrap>
      )}
      {isOpenInFloatingSidebar && (horizontal || sidebarCollapsed) && (
        <FloatingSidebar accordionRef={accoridonRef} horizontal={horizontal}>
          <SidebarItemLabel>{itemProps.label}</SidebarItemLabel>
          {children}
        </FloatingSidebar>
      )}
    </SidebarAccordionWrapper>
  );
}

export {SidebarAccordion};

function findChildElementsInTree(
  children: React.ReactNode,
  componentName: string,
  found: Array<React.ReactNode> = []
): React.ReactNode {
  Children.toArray(children).forEach(child => {
    if (!isValidElement(child)) {
      return;
    }

    const currentComponentName: string =
      typeof child.type === 'string'
        ? child.type
        : 'displayName' in child.type
          ? (child.type.displayName as string) // `.displayName` is added by `babel-plugin-add-react-displayname` in production builds
          : child.type.name; // `.name` is available in development builds

    if (currentComponentName === componentName) {
      found.push(child);
      return;
    }

    if (child?.props?.children) {
      findChildElementsInTree(child.props.children, componentName, found);
      return;
    }

    return;
  });

  return found;
}

const SidebarItemLabel = styled('div')`
  color: ${p => p.theme.gray300};
  padding: ${space(1)} 0 ${space(1)} 18px;
  font-size: ${p => p.theme.fontSizeLarge};
  white-space: nowrap;
`;

const FloatingSidebar = styled('div')<{
  accordionRef: React.RefObject<HTMLDivElement>;
  horizontal: boolean;
}>`
  position: absolute;
  width: ${p => (p.horizontal ? '100%' : '200px')};
  padding: ${space(2)};
  top: ${p =>
    p.horizontal
      ? p.theme.sidebar.mobileHeight
      : p.accordionRef.current?.getBoundingClientRect().top};
  left: ${p =>
    p.horizontal ? 0 : `calc(${p.theme.sidebar.collapsedWidth} + ${space(1)})`};
  background-color: white;

  animation: fadeIn 0.3s ease-in-out;
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  ${p => !p.horizontal && `box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);`}
`;

const SidebarAccordionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1px;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;

const SidebarAccordionHeaderWrap = styled('div')`
  position: relative;
  display: flex;
  & > *:first-child {
    width: 100%;
    flex-shrink: 1;
  }
`;

const SidebarAccordionExpandButton = styled(Button)<{sidebarCollapsed?: boolean}>`
  height: calc(100% - ${space(1)});
  margin: 0 -${space(0.5)};
  padding: 0 ${space(0.75)};
  border-radius: calc(${p => p.theme.borderRadius} - 2px);
  color: ${p => p.theme.subText};

  &:hover,
  a:hover &,
  a[active] & {
    color: ${p => p.theme.white};
  }

  ${p => p.sidebarCollapsed && `display: none;`}
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;

const SidebarAccordionSubitemsWrap = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;
