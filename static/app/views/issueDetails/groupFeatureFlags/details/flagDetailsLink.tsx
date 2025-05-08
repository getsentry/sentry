import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface Props {
  children: React.ReactNode;
  flag: GroupTag;
}

export default function FlagDetailsLink({flag, children}: Props) {
  const location = useLocation();

  return (
    <StyledLink
      to={{
        pathname: `${location.pathname}${flag.key}/`,
        query: {
          ...location.query,
          tab: DrawerTab.FEATURE_FLAGS,
        },
      }}
    >
      {children}
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  border-radius: ${p => p.theme.borderRadius};

  ${p => p.theme.overflowEllipsis}
  width: auto;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;
