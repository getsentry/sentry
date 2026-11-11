import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {useIssueDetailsLinks} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {usePrefetchTagValues} from 'sentry/views/issueDetails/utils';

import type {GroupTag} from './useGroupTags';

export function TagDetailsLink({
  tag,
  groupId,
  children,
}: {
  children: React.ReactNode;
  groupId: string;
  tag: GroupTag;
}) {
  const [prefetchEnabled, setPrefetchEnabled] = useState(false);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const links = useIssueDetailsLinks();

  usePrefetchTagValues(tag.key, groupId, prefetchEnabled);

  // We only want to prefetch if the user hovers over the tag for 1 second
  // This is to prevent every tag from prefetch when a user scrolls
  const handleMouseEnter = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setPrefetchEnabled(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <StyledLink
      to={links.drawer(IssueDetailsDrawer.DISTRIBUTIONS, {tagKey: tag.key})}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  border-radius: ${p => p.theme.radius.md};
  display: block;

  &:hover h5 {
    text-decoration: underline;
  }
`;
