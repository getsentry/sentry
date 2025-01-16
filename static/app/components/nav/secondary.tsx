import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link, {type LinkProps} from 'sentry/components/links/link';
import {useNavContext} from 'sentry/components/nav/context';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

type SecondaryNavProps = {
  children: ReactNode;
};

interface SecondaryNavItemProps extends Omit<LinkProps, 'ref'> {
  children: ReactNode;
  to: string;
  isActive?: boolean;
}

export function SecondaryNav({children}: SecondaryNavProps) {
  const {secondaryNavEl} = useNavContext();

  if (!secondaryNavEl) {
    return null;
  }

  return createPortal(children, secondaryNavEl);
}

SecondaryNav.Body = function SecondaryNavBody({children}: {children: ReactNode}) {
  return <Body>{children}</Body>;
};

SecondaryNav.Section = function SecondaryNavSection({
  title,
  children,
}: {
  children: ReactNode;
  title?: ReactNode;
}) {
  return (
    <Section>
      <SectionSeparator />
      {title && <SectionTitle>{title}</SectionTitle>}
      {children}
    </Section>
  );
};

SecondaryNav.Item = function SecondaryNavItem({
  children,
  to,
  isActive: incomingIsActive,
  ...linkProps
}: SecondaryNavItemProps) {
  const {pathname} = useLocation();
  const isActive = incomingIsActive || pathname.startsWith(to);

  return (
    <Item
      {...linkProps}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      aria-selected={isActive}
    >
      <InteractionStateLayer hasSelectedBackground={isActive} />
      {children}
    </Item>
  );
};

SecondaryNav.Footer = function SecondaryNavFooter({children}: {children: ReactNode}) {
  return <Footer>{children}</Footer>;
};

const Body = styled('div')`
  padding: ${space(1)};
  overflow-y: auto;
`;

const Section = styled('div')`
  & + & {
    hr {
      display: block;
    }
  }
`;

const SectionTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
  padding: 0 ${space(1.5)};
  margin: ${space(2)} 0 ${space(0.5)} 0;
`;

const SectionSeparator = styled('hr')`
  display: none;

  height: 1px;
  background: ${p => p.theme.innerBorder};
  margin: ${space(1.5)} ${space(1)};
  border: none;
`;

const Item = styled(Link)`
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
    background: rgba(62, 52, 70, 0.09);
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
`;

const Footer = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;
