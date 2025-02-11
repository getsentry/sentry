import {type ReactNode, useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
import type {To} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link, {type LinkProps} from 'sentry/components/links/link';
import {useNavContext} from 'sentry/components/nav/context';
import {NavLayout, type PrimaryNavGroup} from 'sentry/components/nav/types';
import {isLinkActive} from 'sentry/components/nav/utils';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

type SecondaryNavProps = {
  children: ReactNode;
  group: PrimaryNavGroup;
};

interface SecondaryNavItemProps extends Omit<LinkProps, 'ref' | 'to'> {
  children: ReactNode;
  to: To;
  /**
   * Will display the link as active under the given path.
   */
  activeTo?: To;
  /**
   * When passed, will not show the link as active for descendant paths.
   * Same as the RR6 `NavLink` `end` prop.
   */
  end?: boolean;
  isActive?: boolean;
}

export function SecondaryNav({children, group}: SecondaryNavProps) {
  const {secondaryNavEl, setActiveGroup} = useNavContext();

  useLayoutEffect(() => {
    setActiveGroup(group);

    return () => {
      setActiveGroup(null);
    };
  }, [group, setActiveGroup]);

  if (!secondaryNavEl) {
    return null;
  }

  return createPortal(children, secondaryNavEl);
}

SecondaryNav.Header = function SecondaryNavHeader({children}: {children: ReactNode}) {
  const {layout} = useNavContext();

  if (layout === NavLayout.MOBILE) {
    return null;
  }

  return <Header>{children}</Header>;
};

SecondaryNav.Body = function SecondaryNavBody({children}: {children: ReactNode}) {
  const {layout} = useNavContext();

  return <Body layout={layout}>{children}</Body>;
};

SecondaryNav.Section = function SecondaryNavSection({
  title,
  children,
}: {
  children: ReactNode;
  title?: ReactNode;
}) {
  const {layout} = useNavContext();

  return (
    <Section>
      <SectionSeparator />
      {title && <SectionTitle layout={layout}>{title}</SectionTitle>}
      {children}
    </Section>
  );
};

SecondaryNav.Item = function SecondaryNavItem({
  children,
  to,
  activeTo = to,
  isActive: incomingIsActive,
  end = false,
  ...linkProps
}: SecondaryNavItemProps) {
  const location = useLocation();
  const isActive = incomingIsActive || isLinkActive(activeTo, location.pathname, {end});

  const {layout} = useNavContext();

  return (
    <Item
      {...linkProps}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      aria-selected={isActive}
      layout={layout}
    >
      <InteractionStateLayer hasSelectedBackground={isActive} />
      {children}
    </Item>
  );
};

SecondaryNav.Footer = function SecondaryNavFooter({children}: {children: ReactNode}) {
  const {layout} = useNavContext();

  return <Footer layout={layout}>{children}</Footer>;
};

const Header = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(2)} ${space(2)} ${space(1)} ${space(2)};
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
  padding: 0 ${space(1.5)};
  margin: ${space(2)} 0 ${space(0.5)} 0;

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

const Item = styled(Link)<{layout: NavLayout}>`
  position: relative;
  display: flex;
  padding: 5px ${space(1.5)};
  height: 34px;
  align-items: center;
  color: inherit;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  line-height: 177.75%;
  border-radius: ${p => p.theme.borderRadius};

  &[aria-selected='true'] {
    color: ${p => p.theme.gray500};
    font-weight: ${p => p.theme.fontWeightBold};
  }

  &:hover {
    color: inherit;
  }

  ${InteractionStateLayer} {
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

const Footer = styled('div')<{layout: NavLayout}>`
  padding: ${space(1)} ${space(1.5)};
  border-top: 1px solid ${p => p.theme.innerBorder};

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: ${space(1)} 0;
    `}
`;
