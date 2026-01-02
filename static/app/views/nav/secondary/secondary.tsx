import type {ReactNode} from 'react';
import type {To} from 'react-router-dom';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Link, type LinkProps} from 'sentry/components/core/link';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {useHovercardContext} from 'sentry/components/hovercard';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {Collapsible} from 'sentry/views/nav/collapsible';
import {SIDEBAR_NAVIGATION_SOURCE} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';

type SecondaryNavProps = {
  children: ReactNode;
  className?: string;
};

interface SecondaryNavItemProps extends Omit<LinkProps, 'ref' | 'to'> {
  children: ReactNode;
  to: To;
  /**
   * Will display the link as active under the given path.
   */
  activeTo?: To;
  analyticsItemName?: string;
  /**
   * When passed, will not show the link as active for descendant paths.
   * Same as the RR6 `NavLink` `end` prop.
   */
  end?: boolean;
  isActive?: boolean;
  leadingItems?: ReactNode;
  showInteractionStateLayer?: boolean;
  trailingItems?: ReactNode;
}

export function SecondaryNav({children, className}: SecondaryNavProps) {
  return (
    <ErrorBoundary mini>
      <Wrapper className={className} role="navigation" aria-label="Secondary Navigation">
        {children}
      </Wrapper>
    </ErrorBoundary>
  );
}

SecondaryNav.Header = function SecondaryNavHeader({children}: {children?: ReactNode}) {
  const {isCollapsed, setIsCollapsed, layout} = useNavContext();

  if (layout === NavLayout.MOBILE) {
    return null;
  }

  return (
    <Header>
      <div>{children}</div>
      <div>
        <Button
          borderless={isCollapsed ? false : true}
          size="xs"
          icon={
            <IconChevron
              direction={isCollapsed ? 'right' : 'left'}
              isDouble
              color={isCollapsed ? 'white' : undefined}
            />
          }
          aria-label={isCollapsed ? t('Expand') : t('Collapse')}
          onClick={() => setIsCollapsed(!isCollapsed)}
          priority={isCollapsed ? 'primary' : undefined}
          analyticsEventName="Sidebar: Secondary Toggle Button Clicked"
          analyticsEventKey="sidebar_secondary_toggle_button_clicked"
          analyticsParams={{
            is_collapsed: isCollapsed,
          }}
        />
      </div>
    </Header>
  );
};

SecondaryNav.Body = function SecondaryNavBody({children}: {children: ReactNode}) {
  const {layout} = useNavContext();

  return <Body layout={layout}>{children}</Body>;
};

function SectionTitle({
  title,
  trailingItems,
  canCollapse,
  isCollapsed,
  setIsCollapsed,
}: {
  canCollapse: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  title: ReactNode;
  trailingItems?: ReactNode;
}) {
  const {layout} = useNavContext();

  if (canCollapse) {
    return (
      <SectionTitleCollapsible
        size="sm"
        borderless
        isMobile={layout === NavLayout.MOBILE}
        onClick={() => {
          setIsCollapsed(!isCollapsed);
        }}
        isCollapsed={isCollapsed}
      >
        <SectionTitleLabelWrap>{title}</SectionTitleLabelWrap>
        <TrailingItems>
          {trailingItems ? (
            <div
              onClick={e => {
                e.stopPropagation();
              }}
            >
              {trailingItems}
            </div>
          ) : (
            canCollapse && (
              <IconChevron
                direction={isCollapsed ? 'down' : 'up'}
                size="xs"
                color="subText"
              />
            )
          )}
        </TrailingItems>
      </SectionTitleCollapsible>
    );
  }

  return (
    <SectionTitleUnCollapsible isMobile={layout === NavLayout.MOBILE}>
      {title}
      {trailingItems}
    </SectionTitleUnCollapsible>
  );
}

SecondaryNav.Section = function SecondaryNavSection({
  id,
  title,
  children,
  className,
  trailingItems,
  collapsible = true,
}: {
  children: ReactNode;
  id: string;
  className?: string;
  collapsible?: boolean;
  title?: ReactNode;
  trailingItems?: ReactNode;
}) {
  const {layout} = useNavContext();
  const [isCollapsedState, setIsCollapsedState] = useLocalStorageState(
    `secondary-nav-section-${id}-collapsed`,
    false
  );
  const canCollapse = collapsible && layout === NavLayout.SIDEBAR;
  const isCollapsed = canCollapse ? isCollapsedState : false;

  return (
    <Section className={className} layout={layout} data-nav-section>
      <SectionSeparator />
      {title ? (
        <SectionTitle
          title={title}
          trailingItems={trailingItems}
          canCollapse={canCollapse}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsedState}
        />
      ) : null}
      <Collapsible collapsed={isCollapsed} disabled={!canCollapse}>
        {children}
      </Collapsible>
    </Section>
  );
};

SecondaryNav.Item = function SecondaryNavItem({
  analyticsItemName,
  children,
  to,
  activeTo = to,
  isActive: incomingIsActive,
  end = false,
  leadingItems,
  showInteractionStateLayer = true,
  trailingItems,
  onClick,
  ...linkProps
}: SecondaryNavItemProps) {
  const organization = useOrganization();
  const location = useLocation();
  const isActive = incomingIsActive ?? isLinkActive(activeTo, location.pathname, {end});

  const {layout} = useNavContext();
  const {reset: closeCollapsedNavHovercard} = useHovercardContext();

  return (
    <Item
      state={{source: SIDEBAR_NAVIGATION_SOURCE}}
      {...linkProps}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      aria-selected={isActive}
      layout={layout}
      onClick={e => {
        if (analyticsItemName) {
          trackAnalytics('navigation.secondary_item_clicked', {
            item: analyticsItemName,
            organization,
          });
        }

        // When this is rendered inside a hovercard (when the nav is collapsed)
        // this will dismiss it when clicking on a link.
        closeCollapsedNavHovercard();

        onClick?.(e);
      }}
    >
      {leadingItems}
      {showInteractionStateLayer && (
        <InteractionStateLayer data-isl hasSelectedBackground={isActive} />
      )}
      <ItemText>{children}</ItemText>
      {trailingItems}
    </Item>
  );
};

SecondaryNav.Footer = function SecondaryNavFooter({children}: {children: ReactNode}) {
  const {layout} = useNavContext();

  return <Footer layout={layout}>{children}</Footer>;
};

function SectionSeparator() {
  return (
    <SeparatorWrapper data-separator>
      <Separator />
    </SeparatorWrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-rows: auto 1fr auto;
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  padding: 0 ${space(1)} 0 ${space(2)};

  /* This is used in detail pages to match the height of sidebar header. */
  height: 44px;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  button {
    color: inherit;
  }
`;

const Body = styled('div')<{layout: NavLayout}>`
  overflow-y: auto;
  overscroll-behavior: contain;

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: 0 0 ${space(1)} 0;
    `}
`;

const Section = styled('div')<{layout: NavLayout}>`
  ${p =>
    p.layout === NavLayout.SIDEBAR &&
    css`
      padding: 0 ${space(1)};
    `}

  &:first-child {
    padding-top: ${space(1)};
  }

  &:last-child {
    padding-bottom: ${space(1)};
  }

  /* Hide separators if there is not a previous section */
  [data-nav-section] + & {
    > [data-separator] {
      display: block;
    }
  }
`;

const sectionTitleStyles = (p: {isMobile: boolean; theme: Theme}) => css`
  font-weight: ${p.theme.fontWeight.bold};
  color: ${p.theme.tokens.content.primary};
  padding: ${space(0.75)} ${space(1)};
  width: 100%;
  ${p.isMobile &&
  css`
    padding: ${space(1)} ${space(1.5)} ${space(1)} 48px;
  `}
`;

const SectionTitleUnCollapsible = styled('div')<{isMobile: boolean}>`
  ${sectionTitleStyles}
  display: flex;
  justify-content: space-between;
`;

const SectionTitleCollapsible = styled(Button, {
  shouldForwardProp: (prop: string) => !['isMobile', 'isCollapsed'].includes(prop),
})<{isCollapsed: boolean; isMobile: boolean}>`
  ${sectionTitleStyles}
  display: flex;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.md};

  & > span:last-child {
    flex: 1;
    justify-content: space-between;
    white-space: nowrap;
  }
`;

const SectionTitleLabelWrap = styled('div')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
`;

const TrailingItems = styled('div')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const SeparatorWrapper = styled('div')`
  margin: ${space(1.5)} 0;
  display: none;
`;

const Separator = styled('hr')`
  height: 1px;
  background: ${p => p.theme.innerBorder};
  margin: 0 ${space(1)};
  border: none;
`;

interface ItemProps extends LinkProps {
  layout: NavLayout;
}

const ChonkItem = styled(Link)<ItemProps>`
  display: flex;
  gap: ${space(0.75)};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.tokens.component.link.muted.default};
  padding: ${p =>
    p.layout === NavLayout.MOBILE
      ? `${space(0.75)} ${space(1.5)} ${space(0.75)} 48px`
      : `${space(0.75)} ${space(1.5)}`};
  border-radius: ${p => p.theme.radius[p.layout === NavLayout.MOBILE ? '0' : 'md']};

  /* Disable interaction state layer */
  > [data-isl] {
    display: none;
  }

  /* Renders the active state indicator */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%) translateX(100%);
    width: 4px;
    height: 20px;
    left: -${space(1.5)};
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => p.theme.colors.blue400};
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.tokens.component.link.muted.default};
    background-color: ${p => p.theme.colors.gray100};
  }

  &[aria-selected='true'] {
    color: ${p => p.theme.tokens.component.link.accent.default};
    background-color: ${p => p.theme.colors.blue100};

    &::before {
      opacity: 1;
    }
    /* Override the default hover styles */
    &:hover {
      background-color: ${p => p.theme.colors.blue200};
    }
  }
`;

const Item = ChonkItem;

const ItemText = styled('span')`
  ${p => p.theme.overflowEllipsis}
`;

const Footer = styled('div')<{layout: NavLayout}>`
  padding: ${space(1)} ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: ${space(1)} 0;
    `}
`;
