import ShortId from 'sentry/components/shortId';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';
import {breadcrumbHasIssue} from 'sentry/views/replays/detail/console/utils';

type Props = {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
};

const ViewIssueLink = ({breadcrumb}: Props) => {
  const organization = useOrganization();

  if (!breadcrumbHasIssue(breadcrumb)) {
    return null;
  }
  const {groupId, groupShortId, eventId} = breadcrumb.data || {};

  const to = {
    pathname: `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/?referrer=replay-console`,
  };
  return <ShortId to={to} shortId={groupShortId} />;
};

export default ViewIssueLink;
