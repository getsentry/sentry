import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useContext,
  useRef,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {Overlay} from 'sentry/components/overlay';
import {SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_MOBILE_HEIGHT} from 'sentry/components/sidebar';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMedia from 'sentry/utils/useMedia';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

import type {SidebarItemProps} from './sidebarItem';
import SidebarItem, {isItemActive} from './sidebarItem';

type SidebarAccordionProps = SidebarItemProps & {
  children?: React.ReactNode;
  initiallyExpanded?: boolean;
};

function SidebarAccordion({
  children,
  initiallyExpanded,
  ...itemProps
}: SidebarAccordionProps) {
  const {id, collapsed: sidebarCollapsed} = itemProps;

  const accordionRef = useRef<HTMLDivElement>(null);
  const mainItemRef = useRef<HTMLDivElement>(null);
  const floatingAccordionRef = useRef<HTMLDivElement>(null);
  const {expandedItemId, setExpandedItemId, shouldAccordionFloat} =
    useContext(ExpandedContext);
  const theme = useTheme();
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useLocalStorageState(
    `sidebar-accordion-${id}:expanded`,
    initiallyExpanded ?? true
  );

  useOnClickOutside(floatingAccordionRef, e => {
    if (mainItemRef?.current?.contains(e.target as Node)) {
      return;
    }
    setExpandedItemId(null);
  });

  const mainItemId = `sidebar-accordion-${id}-item`;
  const contentId = `sidebar-accordion-${id}-content`;
  const isOpenInFloatingSidebar = expandedItemId === mainItemId;

  const isActive = isItemActive(itemProps);
  const hasMainLink = Boolean(itemProps.to);

  const childSidebarItems = findChildElementsInTree(children, SidebarItem.displayName);

  const hasActiveChildren = Children.toArray(childSidebarItems).some(child => {
    if (isValidElement(child)) {
      return isItemActive(child.props);
    }

    return false;
  });

  const childrenWithProps = renderChildrenWithProps(children);

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
      setExpandedItemId(null);
      if (!hasMainLink) {
        setExpanded(!expanded);
      }
      return;
    }

    e.preventDefault();
    if (isOpenInFloatingSidebar) {
      setExpandedItemId(null);
    } else {
      setExpandedItemId(mainItemId);
    }
  };

  const handleTitleClick: (
    id: string,
    e: React.MouseEvent<HTMLAnchorElement>
  ) => void = () => {
    if (itemProps.to) {
      navigate(itemProps.to);
      setExpandedItemId(null);
    }
  };

  let isMainItemActive = isActive && !hasActiveChildren;
  if (shouldAccordionFloat) {
    isMainItemActive = isActive || hasActiveChildren;
  }

  return (
    <SidebarAccordionWrapper ref={accordionRef}>
      <SidebarAccordionHeaderWrap>
        <div ref={mainItemRef}>
          <SidebarItem
            {...itemProps}
            active={isMainItemActive}
            id={mainItemId}
            data-test-id={mainItemId}
            aria-expanded={expanded}
            aria-owns={contentId}
            onClick={handleMainItemClick}
            isOpenInFloatingSidebar={isOpenInFloatingSidebar}
            trailingItems={
              <SidebarAccordionExpandButton
                size="zero"
                borderless
                onClick={handleExpandAccordionClick}
                aria-controls={mainItemId}
                aria-label={expanded ? t('Collapse') : t('Expand')}
                sidebarCollapsed={sidebarCollapsed}
              >
                <Chevron direction={expanded ? 'up' : 'down'} role="presentation" />
              </SidebarAccordionExpandButton>
            }
          />
        </div>
      </SidebarAccordionHeaderWrap>
      {expanded && !horizontal && !sidebarCollapsed && (
        <SidebarAccordionSubitemsWrap id={contentId}>
          {childrenWithProps}
        </SidebarAccordionSubitemsWrap>
      )}
      {isOpenInFloatingSidebar && (horizontal || sidebarCollapsed) && (
        <StyledOverlay
          animated
          accordionRef={accordionRef}
          ref={floatingAccordionRef}
          horizontal={horizontal}
          data-test-id="floating-accordion"
        >
          <SidebarItem
            {...itemProps}
            active={isActive && !hasActiveChildren}
            onClick={handleTitleClick}
            isMainItem
          />
          {childrenWithProps}
        </StyledOverlay>
      )}
    </SidebarAccordionWrapper>
  );
}

export {SidebarAccordion};

const renderChildrenWithProps = (children: React.ReactNode): React.ReactNode => {
  const propsToAdd: Partial<SidebarItemProps> = {
    isNested: true,
  };

  return Children.map(children, child => {
    if (!isValidElement(child)) {
      return child;
    }
    return cloneElement(child as React.ReactElement<any>, {
      ...propsToAdd,
      children: renderChildrenWithProps(
        (child as React.ReactElement<any>).props.children
      ),
    });
  });
};

function findChildElementsInTree(
  children: React.ReactNode,
  componentName: string,
  found: React.ReactNode[] = []
): React.ReactNode {
  Children.toArray(children).forEach(child => {
    if (!isValidElement(child)) {
      return;
    }

    const currentComponentName: string =
      typeof child.type === 'string'
        ? child.type
        : 'displayName' in child.type
          ? (child.type.displayName as string) // `.displayName` is added manually
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

const StyledOverlay = styled(Overlay)<{
  accordionRef: React.RefObject<HTMLDivElement>;
  horizontal: boolean;
}>`
  position: absolute;
  width: ${p => (p.horizontal ? '100%' : '200px')};
  padding: ${space(0.5)};
  top: ${p =>
    p.horizontal
      ? SIDEBAR_MOBILE_HEIGHT
      : p.accordionRef.current?.getBoundingClientRect().top};
  left: ${p => (p.horizontal ? 0 : `calc(${SIDEBAR_COLLAPSED_WIDTH} + ${space(1)})`)};
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
