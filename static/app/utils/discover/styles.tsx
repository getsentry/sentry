import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';
import ShortId, {StyledAutoSelectText} from 'sentry/components/shortId';
import {IconUser} from 'sentry/icons/iconUser';

// Styled components used to render discover result sets.

export const Container = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  span {
    vertical-align: middle;
  }
`;

export const VersionContainer = styled('div')`
  display: flex;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const NumberContainer = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  span {
    vertical-align: middle;
  }
`;

export const FieldDateTime = styled(DateTime)`
  color: ${p => p.theme.tokens.content.secondary};
  font-variant-numeric: tabular-nums;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const OverflowLink = styled(Link)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const FieldShortId = styled(ShortId)`
  justify-content: flex-start;
  display: block;
`;

export const OverflowFieldShortId = styled(FieldShortId)`
  max-width: 100%;

  ${StyledAutoSelectText} {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
  margin-left: ${p => p.theme.space.md};
  color: ${p => p.theme.colors.gray500};
`;

export const IconContainer = styled((props: {children: React.ReactNode}) => {
  return <Flex gap="md">{props.children}</Flex>;
})``;
