import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import * as qs from 'query-string';

import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconSentry, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {StatusWarning} from 'sentry/types/workflowEngine/automations';
import {defined} from 'sentry/utils';

export type TitleCellProps = {
  link: LocationDescriptor | null;
  name: string;
  className?: string;
  details?: React.ReactNode;
  disabled?: boolean;
  openInNewTab?: boolean;
  systemCreated?: string;
  warning?: StatusWarning | null;
};

export function TitleCell({
  name,
  systemCreated,
  details,
  link,
  disabled = false,
  className,
  warning,
  openInNewTab,
}: TitleCellProps) {
  const content = (
    <Fragment>
      <Name>
        <NameText>{name}</NameText>
        {systemCreated && (
          <Tooltip title={systemCreated} skipWrapper>
            <CreatedBySentryIcon size="xs" variant="muted" />
          </Tooltip>
        )}
        {warning && (
          <Fragment>
            &mdash;
            <Tooltip title={warning.message} skipWrapper>
              <Flex gap="sm" align="center">
                {warning.color === 'danger' && <Text variant="danger">Invalid</Text>}
                <IconWarning variant={warning.color} />
              </Flex>
            </Tooltip>
          </Fragment>
        )}
        {disabled && (
          <Container as="span" flexShrink={0}>
            &mdash; Disabled
          </Container>
        )}
      </Name>
      {defined(details) && <DetailsWrapper>{details}</DetailsWrapper>}
    </Fragment>
  );

  if (!link) {
    return (
      <TitleBase className={className} noHover>
        {content}
      </TitleBase>
    );
  }

  if (openInNewTab) {
    let href: string;
    if (typeof link === 'string') {
      href = link;
    } else {
      const pathname = link.pathname ?? '';
      const search = link.search ?? (link.query ? `?${qs.stringify(link.query)}` : '');
      const hash = link.hash ?? '';
      href = `${pathname}${search}${hash}`;
    }
    return (
      <TitleWrapperAnchor
        href={href}
        className={className}
        target="_blank"
        rel="noreferrer noopener"
      >
        {content}
      </TitleWrapperAnchor>
    );
  }

  return (
    <TitleWrapper to={link} className={className}>
      {content}
    </TitleWrapper>
  );
}

const Name = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const NameText = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: fit-content;
`;

const CreatedBySentryIcon = styled(IconSentry)`
  flex-shrink: 0;
`;

const TitleBase = styled('div')<{noHover?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
  overflow: hidden;
  min-height: 20px;

  ${p =>
    !p.noHover &&
    `
    &:hover {
      ${NameText} {
        text-decoration: underline;
      }
    }
  `}
`;

const TitleWrapper = TitleBase.withComponent(Link);
const TitleWrapperAnchor = TitleBase.withComponent(ExternalLink);

const DetailsWrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;
