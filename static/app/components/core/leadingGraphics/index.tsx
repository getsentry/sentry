import {Fragment} from 'react';
import PlatformIcon from 'platformicons/build/platformIcon';

import {Container, Stack} from '@sentry/scraps/layout';

import {IconAllProjects, IconMyProjects} from 'sentry/icons';

// badge-project variant — absorbs the 0/1/2+ platform logic from
// SecondaryNavigationProjectIcon so both nav and breadcrumbs share one component.
interface LeadingGraphicsBadgeProject {
  /**
   * Platform slugs for the project(s) to display.
   * - 0 entries: renders an all-projects or my-projects icon
   * - 1 entry: renders a single bordered platform icon
   * - 2+ entries: renders two stacked platform icons (top-right + bottom-right)
   */
  projectPlatforms: string[];
  variant: 'badge-project';
  /** When projectPlatforms is empty, use all-projects icon instead of my-projects */
  allProjects?: boolean;
}

interface LeadingGraphicsIcon {
  icon: React.ReactNode;
  variant: 'icon';
}

interface LeadingGraphicsAvatar {
  avatar: React.ReactNode;
  variant: 'avatar';
}

export type LeadingGraphicsProps =
  | LeadingGraphicsBadgeProject
  | LeadingGraphicsIcon
  | LeadingGraphicsAvatar;

/**
 * A 16×16 leading graphic used by breadcrumb items and navigation links.
 * Supports three visual variants: badge-project (platform icons), icon, and avatar.
 */
export function LeadingGraphics(props: LeadingGraphicsProps) {
  if (props.variant === 'icon') {
    return (
      <Stack
        flexShrink={0}
        justify="center"
        align="center"
        width="16px"
        height="16px"
        aria-hidden="true"
      >
        {props.icon}
      </Stack>
    );
  }

  if (props.variant === 'avatar') {
    return (
      <Stack
        flexShrink={0}
        justify="center"
        align="center"
        width="16px"
        height="16px"
        aria-hidden="true"
      >
        {props.avatar}
      </Stack>
    );
  }

  // badge-project variant
  return <BadgeProjectGraphic {...props} />;
}

function BadgeProjectGraphic({
  projectPlatforms,
  allProjects,
}: LeadingGraphicsBadgeProject) {
  let icons: React.ReactNode;

  switch (projectPlatforms.length) {
    case 0:
      icons = allProjects ? (
        <IconAllProjects size="xs" aria-hidden="true" />
      ) : (
        <IconMyProjects size="xs" aria-hidden="true" />
      );
      break;

    case 1:
      icons = (
        <Container
          position="absolute"
          top="1px"
          left="1px"
          width="14px"
          height="14px"
          overflow="hidden"
          radius="2xs"
          border="muted"
        >
          {p => (
            <PlatformIcon
              {...p}
              platform={projectPlatforms[0] ?? ''}
              size={14}
              aria-hidden
            />
          )}
        </Container>
      );
      break;

    default:
      // Two overlapping icons: first at top-right, second at bottom-right.
      // Positioned within a 16×16 container:
      //   first:  right=4px → left edge at 0px (x: 0–12)
      //   second: right=0   → left edge at 4px (x: 4–16)
      icons = (
        <Fragment>
          <Container position="absolute" top="0" right="4px" width="12px" height="12px">
            {p => (
              <PlatformIcon
                {...p}
                platform={projectPlatforms[0] ?? ''}
                size={12}
                aria-hidden
              />
            )}
          </Container>
          <Container position="absolute" bottom="0" right="0" width="12px" height="12px">
            {p => (
              <PlatformIcon
                {...p}
                platform={projectPlatforms[1] ?? ''}
                size={12}
                aria-hidden
              />
            )}
          </Container>
        </Fragment>
      );
  }

  return (
    <Stack
      flexShrink={0}
      justify="center"
      align="center"
      width="16px"
      height="16px"
      position="relative"
      aria-hidden="true"
    >
      {icons}
    </Stack>
  );
}
