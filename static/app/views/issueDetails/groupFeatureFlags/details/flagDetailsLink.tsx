import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {useLocation} from 'sentry/utils/useLocation';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface Props {
  children: React.ReactNode;
  flag: GroupTag;
}

export default function FlagDetailsLink({flag, children}: Props) {
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();

  return (
    <StyledLink
      to={{
        pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}${flag.key}/`,
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
  border-radius: ${p => p.theme.radius.md};

  ${p => p.theme.overflowEllipsis}
  width: auto;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;
