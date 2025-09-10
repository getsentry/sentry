import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconSentry, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

export type TitleWarning = {
  color: 'danger' | 'warning';
  message: string;
};

export type TitleCellProps = {
  link: string;
  name: string;
  className?: string;
  details?: React.ReactNode;
  disabled?: boolean;
  systemCreated?: boolean;
  warning?: TitleWarning | null;
};

export function TitleCell({
  name,
  systemCreated,
  details,
  link,
  disabled = false,
  className,
  warning,
}: TitleCellProps) {
  return (
    <TitleWrapper to={link} className={className}>
      <Name>
        <NameText>{name}</NameText>
        {systemCreated && <CreatedBySentryIcon size="xs" color="subText" />}
        {warning && (
          <Fragment>
            &mdash;
            <Tooltip title={warning.message}>
              <WarningWrapper>
                {warning.color === 'danger' && <InvalidText>Invalid</InvalidText>}
                <IconWarning color={warning.color} />
              </WarningWrapper>
            </Tooltip>
          </Fragment>
        )}
        {disabled && <DisabledText>&mdash; Disabled</DisabledText>}
      </Name>
      {defined(details) && <DetailsWrapper>{details}</DetailsWrapper>}
    </TitleWrapper>
  );
}

const Name = styled('div')`
  color: ${p => p.theme.textColor};
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

const InvalidText = styled('span')`
  flex-shrink: 0;
  color: ${p => p.theme.danger};
`;

const WarningWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  flex-shrink: 0;
`;

const CreatedBySentryIcon = styled(IconSentry)`
  flex-shrink: 0;
`;

const TitleWrapper = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
  overflow: hidden;
  min-height: 20px;

  &:hover {
    ${NameText} {
      text-decoration: underline;
    }
  }
`;

const DetailsWrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.subText};
  white-space: nowrap;
`;
