import {useEffect, useRef, useState} from 'react';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
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
  const hoverTimeoutRef = useRef<number | undefined>();

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
    <Link
      to={{
        pathname: `${location.pathname}${tag.key}/`,
        query: location.query,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Link>
  );
}
