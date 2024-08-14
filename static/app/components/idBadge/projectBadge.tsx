import {cloneElement} from 'react';
import styled from '@emotion/styled';

import type {LinkProps} from 'sentry/components/links/link';
import Link from 'sentry/components/links/link';
import type {AvatarProject} from 'sentry/types/project';
import getPlatformName from 'sentry/utils/getPlatformName';
import useOrganization from 'sentry/utils/useOrganization';

import BadgeDisplayName from './badgeDisplayName';
import {BaseBadge, type BaseBadgeProps} from './baseBadge';

export interface ProjectBadgeProps extends BaseBadgeProps {
  project: AvatarProject;
  /**
   * If true, this component will not be a link to project details page
   */
  disableLink?: boolean;
  displayPlatformName?: boolean;
  /**
   * Hide project name and only display badge.
   */
  hideName?: boolean;
  /**
   * If true, will use default max-width, or specify one as a string
   */
  hideOverflow?: boolean | string;
  /**
   * Overrides where the project badge links
   */
  to?: LinkProps['to'];
}

function ProjectBadge({
  project,
  to,
  hideOverflow = true,
  hideName = false,
  disableLink = false,
  displayPlatformName = false,
  className,
  ...props
}: ProjectBadgeProps) {
  const organization = useOrganization({allowNull: true});
  const {slug, id} = project;

  const badge = (
    <BaseBadge
      hideName={hideName}
      displayName={
        <BadgeDisplayName hideOverflow={hideOverflow}>
          {displayPlatformName && project.platform
            ? getPlatformName(project.platform)
            : slug}
        </BadgeDisplayName>
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
}

const StyledLink = styled(Link)`
  flex-shrink: 0;

  img:hover {
    cursor: pointer;
  }
`;

export default ProjectBadge;
