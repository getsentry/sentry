import {Children, isValidElement, useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import SidebarItem, {isItemActive, SidebarItemProps} from './sidebarItem';

type SidebarAccordionProps = SidebarItemProps & {
  children?: React.ReactNode;
};

function SidebarAccordion({children, ...itemProps}: SidebarAccordionProps) {
  const {id, collapsed: sidebarCollapsed} = itemProps;
  const [expanded, setExpanded] = useLocalStorageState(
    `sidebar-accordion-${id}:expanded`,
    true
  );

  const mainItemId = `sidebar-accordion-${id}-item`;
  const contentId = `sidebar-accordion-${id}-content`;

  const isActive = isItemActive(itemProps);
  const hasActiveChildren = Children.toArray(children).some(child => {
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

  return (
    <SidebarAccordionWrapper>
      <SidebarAccordionHeaderWrap>
        <SidebarItem
          {...itemProps}
          active={isActive && !hasActiveChildren}
          id={mainItemId}
          aria-expanded={expanded}
          aria-owns={contentId}
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
      {expanded && (
        <SidebarAccordionSubitemsWrap id={contentId}>
          {children}
        </SidebarAccordionSubitemsWrap>
      )}
    </SidebarAccordionWrapper>
  );
}

export {SidebarAccordion};

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

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;
