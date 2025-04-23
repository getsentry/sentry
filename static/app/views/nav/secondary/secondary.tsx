import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {To} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link, {type LinkProps} from 'sentry/components/links/link';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';
import {isLinkActive} from 'sentry/views/nav/utils';

type SecondaryNavProps = {
  children: ReactNode;
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

export function SecondaryNav({children}: SecondaryNavProps) {
  const {secondaryNavEl} = useNavContext();

  if (!secondaryNavEl) {
    return null;
  }

  return createPortal(children, secondaryNavEl);
}

SecondaryNav.Header = function SecondaryNavHeader({children}: {children: ReactNode}) {
  const {isCollapsed, setIsCollapsed, layout} = useNavContext();

  if (layout === NavLayout.MOBILE) {
    return null;
  }

  return (
    <Header>
      <div>{children}</div>
      <div>
        <Button
          borderless
          size="xs"
          icon={<IconChevron direction={isCollapsed ? 'right' : 'left'} isDouble />}
          aria-label={isCollapsed ? t('Expand') : t('Collapse')}
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
      </div>
    </Header>
  );
};

SecondaryNav.Body = function SecondaryNavBody({children}: {children: ReactNode}) {
  const {layout} = useNavContext();

  return <Body layout={layout}>{children}</Body>;
};

SecondaryNav.Section = function SecondaryNavSection({
  title,
  children,
  trailingItems,
}: {
  children: ReactNode;
  title?: ReactNode;
  trailingItems?: ReactNode;
}) {
  const {layout} = useNavContext();

  return (
    <Section>
      <SectionSeparator />
      {title && (
        <SectionTitle layout={layout}>
          {title}
          {trailingItems}
        </SectionTitle>
      )}
      {children}
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
  ...linkProps
}: SecondaryNavItemProps) {
  const organization = useOrganization();
  const location = useLocation();
  const isActive = incomingIsActive ?? isLinkActive(activeTo, location.pathname, {end});

  const {layout} = useNavContext();

  return (
    <Item
      {...linkProps}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      aria-selected={isActive}
      layout={layout}
      onClick={() => {
        if (analyticsItemName) {
          trackAnalytics('navigation.secondary_item_clicked', {
            item: analyticsItemName,
            organization,
          });
        }
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

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
  padding: 0 ${space(1)} 0 ${space(2)};
  height: 44px;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  button {
    color: inherit;
  }
`;

const Body = styled('div')<{layout: NavLayout}>`
  padding: ${space(1)};
  overflow-y: auto;

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: 0 0 ${space(1)} 0;
    `}
`;

const Section = styled('div')`
  & + & {
    hr {
      display: block;
    }
  }
`;

const SectionTitle = styled('div')<{layout: NavLayout}>`
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
  padding: 0 ${space(1)};
  margin: ${space(2)} 0 ${space(0.5)} 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: 0 ${space(1.5)} 0 48px;
    `}
`;

const SectionSeparator = styled('hr')`
  display: none;

  height: 1px;
  background: ${p => p.theme.innerBorder};
  margin: ${space(1.5)} ${space(1)};
  border: none;
`;

interface ItemProps extends LinkProps {
  layout: NavLayout;
}

const ChonkItem = chonkStyled(Link)<ItemProps>`
  display: flex;
  gap: ${space(1)};
  justify-content: center;
  align-items: center;
  position: relative;
  color: ${p => p.theme.textColor};
  padding: ${p => (p.layout === NavLayout.MOBILE ? `${space(0.75)} ${space(1.5)} ${space(0.75)} 48px` : `${space(0.75)} ${space(1.5)}`)};
  border-radius: ${p => (p.layout === NavLayout.MOBILE ? '0' : p.theme.radius.lg)};

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
    border-radius: ${p => p.theme.radius.micro};
    background-color: ${p => p.theme.colors.blue400};
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.textColor};
    background-color: ${p => p.theme.colors.gray100};
  }

  &[aria-selected='true'] {
    color: ${p => p.theme.colors.blue400};
    background-color: ${p => p.theme.colors.blue100};

    &::before {
      opacity: 1;
    }
    /* Override the default hover styles */
    &:hover {
      background-color: ${p => p.theme.colors.blue100};
    }
  }
`;

const StyledNavItem = styled(Link)<ItemProps>`
  position: relative;
  display: flex;
  padding: 4px ${space(1)};
  height: 34px;
  align-items: center;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  line-height: 177.75%;
  border-radius: ${p => p.theme.borderRadius};

  &[aria-selected='true'] {
    color: ${p => p.theme.purple400};
    font-weight: ${p => p.theme.fontWeightBold};

    &:hover {
      color: ${p => p.theme.purple400};
    }
  }

  &:hover {
    color: inherit;
  }

  [data-isl] {
    transform: translate(0, 0);
    top: 1px;
    bottom: 1px;
    right: 0;
    left: 0;
    width: initial;
    height: initial;
  }

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: 0 ${space(1.5)} 0 48px;
      border-radius: 0;
    `}
`;

const Item = withChonk(StyledNavItem, ChonkItem);

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
