import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import ShortId from 'sentry/components/shortId';
import space from 'sentry/styles/space';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';
import {breadcrumbHasIssue} from 'sentry/views/replays/detail/console/utils';

type Props = {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
};

function ViewIssueLink({breadcrumb}: Props) {
  const organization = useOrganization();

  if (!breadcrumbHasIssue(breadcrumb)) {
    return null;
  }
  const {groupId, groupShortId, eventId} = breadcrumb.data || {};

  const to = {
    pathname: `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/?referrer=replay-console`,
  };
  return (
    <Link to={to}>
      <ShortIdBreadrcumb>
        <ShortId to={to} shortId={groupShortId} />
      </ShortIdBreadrcumb>
    </Link>
  );
}

const ShortIdBreadrcumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

export default ViewIssueLink;
