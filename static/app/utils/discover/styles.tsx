import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import ShortId from 'app/components/shortId';
import {IconUser} from 'app/icons/iconUser';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

/**
 * Styled components used to render discover result sets.
 */
export const Container = styled('div')`
  ${overflowEllipsis};
`;

export const VersionContainer = styled('div')`
  display: flex;
`;

export const NumberContainer = styled('div')`
  text-align: right;
  ${overflowEllipsis};
`;

export const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray300};
  ${overflowEllipsis};
`;

export const OverflowLink = styled(Link)`
  ${overflowEllipsis};
`;

export const StyledShortId = styled(ShortId)`
  justify-content: flex-start;
`;

export const BarContainer = styled('div')`
  max-width: 80px;
  margin-left: auto;
`;

export const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
`;

export const UserIcon = styled(IconUser)`
  margin-left: ${space(1)};
  color: ${p => p.theme.gray400};
`;
