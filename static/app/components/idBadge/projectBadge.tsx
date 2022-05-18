import {cloneElement} from 'react';
import styled from '@emotion/styled';

import BadgeDisplayName from 'sentry/components/idBadge/badgeDisplayName';
import BaseBadge from 'sentry/components/idBadge/baseBadge';
import Link, {LinkProps} from 'sentry/components/links/link';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type Project = NonNullable<BaseBadgeProps['project']>;

interface Props
  extends Partial<Omit<BaseBadgeProps, 'project' | 'organization' | 'team'>> {
  project: Project;
  className?: string;
  /**
   * If true, this component will not be a link to project details page
   */
  disableLink?: boolean;
  /**
   * If true, will use default max-width, or specify one as a string
   */
  hideOverflow?: boolean | string;
  organization?: Organization;
  /**
   * Overides where the project badge links
   */
  to?: LinkProps['to'];
}

const ProjectBadge = ({
  project,
  organization,
  to,
  hideOverflow = true,
  disableLink = false,
  className,
  ...props
}: Props) => {
  const {slug, id} = project;

  const badge = (
    <BaseBadge
      displayName={
        <BadgeDisplayName hideOverflow={hideOverflow}>{slug}</BadgeDisplayName>
      }
      project={project}
      {...props}
    />
  );

  if (!disableLink && organization?.slug) {
    const defaultTo = `/organizations/${organization.slug}/projects/${slug}/${
      id ? `?project=${id}` : ''
    }`;

    return (
      <StyledLink to={to ?? defaultTo} className={className}>
        {badge}
      </StyledLink>
    );
  }

  return cloneElement(badge, {className});
};

const StyledLink = styled(Link)`
  flex-shrink: 0;

  img:hover {
    cursor: pointer;
  }
`;

export default withOrganization(ProjectBadge);
