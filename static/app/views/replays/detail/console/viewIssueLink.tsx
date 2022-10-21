import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
};

function ViewIssueLink({breadcrumb}: Props) {
  const organization = useOrganization();

  const {project: projectSlug, groupId, groupShortId, eventId} = breadcrumb.data || {};
  if (!groupId || !groupShortId || !eventId) {
    return null;
  }

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
          <StyledShortId to={to} shortId={groupShortId} />
        </ShortIdBreadrcumb>
      }
    >
      <StyledButton to={to} priority="link">
        {t('View Details')}
      </StyledButton>
    </StyledHovercard>
  );
}

const StyledButton = styled(Button)`
  height: auto;
  min-height: auto;
`;

const ShortIdBreadrcumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
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
