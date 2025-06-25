import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

export type TitleCellProps = {
  link: string;
  name: string;
  className?: string;
  details?: React.ReactNode;
  disabled?: boolean;
  systemCreated?: boolean;
};

export function TitleCell({
  name,
  systemCreated,
  details,
  link,
  disabled = false,
  className,
}: TitleCellProps) {
  return (
    <TitleWrapper to={link} disabled={disabled} className={className}>
      <Name disabled={disabled}>
        <NameText>{name}</NameText>
        {systemCreated && <CreatedBySentryIcon size="xs" color="subText" />}
        {disabled && <span>&mdash; Disabled</span>}
      </Name>
      {defined(details) && <DetailsWrapper>{details}</DetailsWrapper>}
    </TitleWrapper>
  );
}

const Name = styled('div')<{disabled: boolean}>`
  color: ${p => p.theme.textColor};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const NameText = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const CreatedBySentryIcon = styled(IconSentry)`
  flex-shrink: 0;
`;

const TitleWrapper = styled(Link)<{disabled: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
  overflow: hidden;

  &:hover {
    ${Name} {
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
