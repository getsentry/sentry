import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export default function FlagDetailsLink({
  tag,
  children,
}: {
  children: React.ReactNode;
  tag: GroupTag;
}) {
  const location = useLocation();

  return (
    <StyledLink
      to={{
        pathname: `${location.pathname}${tag.key}/`,
        query: location.query,
      }}
    >
      {children}
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  border-radius: ${p => p.theme.borderRadius};
  display: block;

  &:hover h5 {
    text-decoration: underline;
  }
`;
