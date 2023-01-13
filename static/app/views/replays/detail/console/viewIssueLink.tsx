import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import ShortId from 'sentry/components/shortId';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
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
  const {project: projectSlug, groupId, groupShortId, eventId} = breadcrumb.data || {};

  const to = {
    pathname: `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/?referrer=replay-console`,
  };
  return (
    <StyledHovercard
      body={
        <ShortIdBreadrcumb>
          <ProjectBadge
            project={{slug: projectSlug}}
            avatarSize={16}
            hideName
            avatarProps={{tooltip: projectSlug}}
          />
          <ShortId to={to} shortId={groupShortId} />
        </ShortIdBreadrcumb>
      }
    >
      <Link to={to}>{t('View Details')}</Link>
    </StyledHovercard>
  );
}

const ShortIdBreadrcumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledHovercard = styled(
  ({children, bodyClassName, ...props}: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard bodyClassName={bodyClassName || '' + ' view-issue-hovercard'} {...props}>
      {children}
    </Hovercard>
  )
)`
  width: auto;
  .view-issue-hovercard {
    padding: ${space(0.75)} ${space(1.5)};
  }
`;

export default ViewIssueLink;
