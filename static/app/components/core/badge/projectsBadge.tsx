import {Fragment} from 'react';
import {PlatformIcon} from 'platformicons';

import {Container, Stack} from '@sentry/scraps/layout';

import {IconAllProjects, IconMyProjects} from 'sentry/icons';

export interface ProjectsBadgeProps {
  /**
   * Platform slugs for the project(s) to display.
   * - 0 entries: renders an all-projects or my-projects icon
   * - 1 entry: renders a single bordered platform icon
   * - 2+ entries: renders two stacked platform icons (top-right + bottom-right)
   */
  projectPlatforms: string[];
  /** When projectPlatforms is empty, use all-projects icon instead of my-projects */
  allProjects?: boolean;
  /**
   * Edge of the square the badge occupies. `16` suits a crumb or a nav row; `24`
   * a page header, where it sits against 16px type and the avatars beside it.
   * @default 16
   */
  size?: 16 | 24;
}

/**
 * A square badge representing the project(s) tied to something — a starred
 * project, saved query, dashboard, issue view, or the entity a page is about.
 * Absorbs the 0/1/2+ platform logic so every call site shares one component.
 *
 * The badge is decorative: it names a platform, not a project, so it cannot say
 * *which* projects on its own. A caller that needs that gives the surrounding
 * element an accessible name.
 */
export function ProjectsBadge({
  projectPlatforms,
  allProjects,
  size = 16,
}: ProjectsBadgeProps) {
  // The stacked geometry is proportional to the box, so both sizes read the
  // same: each icon is three quarters of the edge, offset by the remainder.
  const stackedIconSize = Math.round(size * 0.75);
  const stackedOffset = size - stackedIconSize;

  let icons: React.ReactNode;

  switch (projectPlatforms.length) {
    case 0:
      icons = allProjects ? (
        <IconAllProjects size={size === 24 ? 'lg' : 'md'} aria-hidden="true" />
      ) : (
        <IconMyProjects size={size === 24 ? 'lg' : 'md'} aria-hidden="true" />
      );
      break;

    case 1:
      icons = (
        <Container
          position="absolute"
          top="0px"
          left="0px"
          width={`${size}px`}
          height={`${size}px`}
          overflow="hidden"
          radius={size === 24 ? 'xs' : '2xs'}
          border="muted"
        >
          {p => (
            <PlatformIcon
              {...p}
              platform={projectPlatforms[0] ?? ''}
              // Inset by the 1px border on each edge.
              size={size - 2}
              aria-hidden
            />
          )}
        </Container>
      );
      break;

    default:
      // Two overlapping icons: first at top-right, second at bottom-right.
      // At 16px that is two 12px icons offset by 4; at 24px, 18px offset by 6.
      icons = (
        <Fragment>
          <Container
            position="absolute"
            top="0"
            right={`${stackedOffset}px`}
            width={`${stackedIconSize}px`}
            height={`${stackedIconSize}px`}
          >
            {p => (
              <PlatformIcon
                {...p}
                platform={projectPlatforms[0] ?? ''}
                size={stackedIconSize}
                aria-hidden
              />
            )}
          </Container>
          <Container
            position="absolute"
            bottom="0"
            right="0"
            width={`${stackedIconSize}px`}
            height={`${stackedIconSize}px`}
          >
            {p => (
              <PlatformIcon
                {...p}
                platform={projectPlatforms[1] ?? ''}
                size={stackedIconSize}
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
      width={`${size}px`}
      height={`${size}px`}
      position="relative"
      aria-hidden="true"
    >
      {icons}
    </Stack>
  );
}
