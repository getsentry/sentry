import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {useLocation} from 'sentry/utils/useLocation';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {usePrefetchTagValues} from 'sentry/views/issueDetails/utils';

export default function TagDetailsLink({
  tag,
  groupId,
  children,
}: {
  children: React.ReactNode;
  groupId: string;
  tag: GroupTag;
}) {
  const location = useLocation();
  const [prefetchEnabled, setPrefetchEnabled] = useState(false);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const {baseUrl} = useGroupDetailsRoute();

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
      to={{
        pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}${tag.key}/`,
        query: location.query,
      }}
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
