import styled from '@emotion/styled';
import * as React from 'react';
import omit from 'lodash/omit';

import Link from 'app/components/links/link';
import ExternalLink from 'app/components/links/externalLink';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type Size = 'small' | 'normal';
type Priority = 'info' | 'warning' | 'success' | 'error' | 'muted';

type LinkProps = React.ComponentPropsWithoutRef<typeof Link>;

type OtherProps = {
  ['data-test-id']?: string;
  icon?: string | React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

type DefaultProps = {
  size: Size;
  priority: Priority;
  withoutMarginBottom: boolean;
  openInNewTab: boolean;
  href?: string;
};

type Props = OtherProps & DefaultProps & Partial<Pick<LinkProps, 'to'>>;

type StyledLinkProps = DefaultProps &
  Partial<Pick<LinkProps, 'to'>> &
  Omit<LinkProps, 'to' | 'size'>;

class AlertLink extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    priority: 'warning',
    size: 'normal',
    withoutMarginBottom: false,
    openInNewTab: false,
  };

  render() {
    const {
      size,
      priority,
      icon,
      children,
      onClick,
      withoutMarginBottom,
      openInNewTab,
      to,
      href,
      ['data-test-id']: dataTestId,
    } = this.props;

    return (
      <StyledLink
        data-test-id={dataTestId}
        to={to}
        href={href}
        onClick={onClick}
        size={size}
        priority={priority}
        withoutMarginBottom={withoutMarginBottom}
        openInNewTab={openInNewTab}
      >
        {icon && <IconWrapper>{icon}</IconWrapper>}
        <AlertLinkText>{children}</AlertLinkText>
        <IconLink>
          <IconChevron direction="right" />
        </IconLink>
      </StyledLink>
    );
  }
}

export default AlertLink;

const StyledLink = styled(({openInNewTab, to, href, ...props}: StyledLinkProps) => {
  const linkProps = omit(props, ['withoutMarginBottom', 'priority', 'size']);
  if (href) {
    return <ExternalLink {...linkProps} href={href} openInNewTab={openInNewTab} />;
  }

  return <Link {...linkProps} to={to || ''} />;
})`
  display: flex;
  background-color: ${p => p.theme.alert[p.priority].backgroundLight};
  color: ${p => p.theme.gray700};
  border: 1px dashed ${p => p.theme.alert[p.priority].border};
  padding: ${p => (p.size === 'small' ? `${space(1)} ${space(1.5)}` : space(2))};
  margin-bottom: ${p => (p.withoutMarginBottom ? 0 : space(3))};
  border-radius: 0.25em;
  transition: 0.2s border-color;

  &.focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.alert[p.priority].border}7f 0 0 0 2px;
  }
`;

const IconWrapper = styled('span')`
  display: flex;
  margin: ${space(0.5)} ${space(1.5)} ${space(0.5)} 0;
`;

const IconLink = styled(IconWrapper)`
  margin: ${space(0.5)} 0;
`;

const AlertLinkText = styled('div')`
  line-height: 1.5;
  flex-grow: 1;
`;
