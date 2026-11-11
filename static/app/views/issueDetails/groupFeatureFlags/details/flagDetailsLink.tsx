import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {useIssueDetailsLinks} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface Props {
  children: React.ReactNode;
  flag: GroupTag;
}

export function FlagDetailsLink({flag, children}: Props) {
  const links = useIssueDetailsLinks();

  return (
    <StyledLink
      to={links.drawer(IssueDetailsDrawer.DISTRIBUTIONS, {
        tagKey: flag.key,
        type: DrawerTab.FEATURE_FLAGS,
      })}
    >
      {children}
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  border-radius: ${p => p.theme.radius.md};

  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;
