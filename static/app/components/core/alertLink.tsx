import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Size = 'small' | 'normal';
type Priority = 'info' | 'warning' | 'success' | 'error' | 'muted';

type LinkProps = React.ComponentPropsWithoutRef<typeof Link>;

type OtherProps = {
  children?: React.ReactNode;
  ['data-test-id']?: string;
  icon?: string | React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

type DefaultProps = {
  openInNewTab: boolean;
  priority: Priority;
  size: Size;
  withoutMarginBottom: boolean;
  href?: string;
  system?: boolean;
};

type Props = OtherProps & Partial<DefaultProps> & Partial<Pick<LinkProps, 'to'>>;

type StyledLinkProps = DefaultProps &
  Partial<Pick<LinkProps, 'to'>> &
  Omit<LinkProps, 'to' | 'size'>;

export function AlertLink({
  size = 'normal',
  priority = 'warning',
  icon,
  children,
  onClick,
  system = false,
  withoutMarginBottom = false,
  openInNewTab = false,
  to,
  href,
  ['data-test-id']: dataTestId,
}: Props) {
  return (
    <StyledLink
      data-test-id={dataTestId}
      to={to}
      href={href}
      onClick={onClick}
      size={size}
      priority={priority}
      system={system}
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

export default AlertLink;

const StyledLink = styled(
  ({openInNewTab, to, href, system: _, ...props}: StyledLinkProps) => {
    const linkProps = omit(props, ['withoutMarginBottom', 'priority', 'size']);
    if (href) {
      return <ExternalLink {...linkProps} href={href} openInNewTab={openInNewTab} />;
    }

    return <Link {...linkProps} to={to || ''} />;
  }
)`
  display: flex;
  align-items: center;
  background-color: ${p => p.theme.alert[p.priority].backgroundLight};
  color: ${p => p.theme.alert[p.priority].color};
  font-size: ${p => p.theme.fontSizeMedium};
  text-decoration-color: ${p => p.theme.alert[p.priority].border};
  text-decoration-style: solid;
  text-decoration-line: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.06em;
  border: 1px solid ${p => p.theme.alert[p.priority].border};
  padding: ${p => (p.size === 'small' ? `${space(1)} ${space(1.5)}` : space(2))};
  margin-bottom: ${p => (p.withoutMarginBottom ? 0 : space(3))};
  border-radius: 0.25em;
  transition: 0.2s border-color;

  &:hover {
    color: ${p => p.theme.alert[p.priority].color};
    text-decoration-color: ${p => p.theme.alert[p.priority].color};
    text-decoration-style: solid;
    text-decoration-line: underline;
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.alert[p.priority].border} 0 0 0 2px;
  }

  ${p =>
    p.system &&
    `
      border-width: 0 0 1px 0;
      border-radius: 0;
    `}
`;

const IconWrapper = styled('span')`
  display: flex;
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  margin-right: ${space(1)};
  align-items: center;
`;

const IconLink = styled(IconWrapper)`
  margin-right: 0;
  margin-left: ${space(1)};
`;

const AlertLinkText = styled('div')`
  line-height: ${p => p.theme.text.lineHeightBody};
  flex-grow: 1;
`;
