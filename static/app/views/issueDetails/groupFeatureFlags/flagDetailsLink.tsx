import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export default function FlagDetailsLink({
  tag,
  children,
}: {
  children: React.ReactNode;
  tag: GroupTag;
}) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <StyledLink
      to={{
        pathname: `${location.pathname}${tag.key}/`,
        query: location.query,
      }}
      onClick={() => {
        trackAnalytics('flags.drawer_details_clicked', {
          organization,
        });
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
