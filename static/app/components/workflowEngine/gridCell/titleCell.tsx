import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconSentry, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {StatusWarning} from 'sentry/types/workflowEngine/automations';
import {defined} from 'sentry/utils';

export type TitleCellProps = {
  link: string | null;
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
        {disabled && <DisabledText>&mdash; Disabled</DisabledText>}
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
    return (
      <TitleWrapperAnchor
        href={link}
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
  font-weight: ${p => p.theme.fontWeight.bold};
  ${p => p.theme.overflowEllipsis};
  width: fit-content;
`;

const DisabledText = styled('span')`
  flex-shrink: 0;
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
