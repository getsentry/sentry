import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import ShortId from 'sentry/components/shortId';
import {IconUser} from 'sentry/icons/iconUser';
import space from 'sentry/styles/space';

// Styled components used to render discover result sets.

export const Container = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

export const VersionContainer = styled('div')`
  display: flex;
`;

export const NumberContainer = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
  ${p => p.theme.overflowEllipsis};
`;

export const FieldDateTime = styled(DateTime)`
  color: ${p => p.theme.gray300};
  font-variant-numeric: tabular-nums;
  ${p => p.theme.overflowEllipsis};
`;

export const OverflowLink = styled(Link)`
  ${p => p.theme.overflowEllipsis};
`;

export const FieldShortId = styled(ShortId)`
  justify-content: flex-start;
  display: block;
`;

export const BarContainer = styled('div')`
  max-width: 80px;
  margin-left: auto;
`;

export const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
`;

export const UserIcon = styled(IconUser)`
  margin-left: ${space(1)};
  color: ${p => p.theme.gray400};
`;

export const ActorContainer = styled('div')`
  display: flex;
  justify-content: center;
  :hover {
    cursor: default;
  }
`;
