import {Fragment} from 'react';
import {PlatformIcon} from 'platformicons';

import {Container, Stack} from '@sentry/scraps/layout';

import {IconAllProjects, IconMyProjects} from 'sentry/icons';

type ProjectsBadgeSize = 'md' | 'lg';

/**
 * Geometry per size, read off the spec frames rather than scaled from the
 * edge: the two sizes do not share one ratio, and at `md` the contents fill
 * the frame while at `lg` they sit inside it.
 *
 * `single` is one platform icon, centred in the frame. `stacked` is each of
 * the two overlapping ones, which start at opposite corners — so their offset
 * is whatever the frame has left over.
 *
 * `radius` is passed to the icon, which rounds itself. Its own default of 3
 * suits `md`; `lg` is drawn a little softer.
 */
const SIZES = {
  md: {frame: 16, single: 16, stacked: 11, radius: 3},
  lg: {frame: 24, single: 20, stacked: 16, radius: 4},
} as const satisfies Record<
  ProjectsBadgeSize,
  {frame: number; radius: number; single: number; stacked: number}
>;

export interface ProjectsBadgeProps {
  /**
   * Platform slugs for the project(s) to display.
   * - 0 entries: renders an all-projects or my-projects icon
   * - 1 entry: renders a single platform icon
   * - 2+ entries: renders two overlapping platform icons (top-left + bottom-right)
   */
  projectPlatforms: string[];
  /** When projectPlatforms is empty, use all-projects icon instead of my-projects */
  allProjects?: boolean;
  /**
   * `md` (16px) suits a crumb or a nav row; `lg` (24px) a page header, where it
   * sits against 16px type and the avatars beside it.
   * @default 'md'
   */
  size?: ProjectsBadgeSize;
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
  size = 'md',
}: ProjectsBadgeProps) {
  const {frame, single, stacked, radius} = SIZES[size];
  const stackedOffset = frame - stacked;

  let icons: React.ReactNode;

  switch (projectPlatforms.length) {
    case 0: {
      const Icon = allProjects ? IconAllProjects : IconMyProjects;
      icons =
        size === 'md' ? (
          <Icon size="md" aria-hidden="true" />
        ) : (
          <Icon legacySize={`${single}px`} aria-hidden="true" />
        );
      break;
    }

    case 1:
      icons = (
        <PlatformIcon
          platform={projectPlatforms[0] ?? ''}
          size={single}
          radius={radius}
          aria-hidden
        />
      );
      break;

    default:
      // Only the overlap needs taking out of flow. A platform icon paints an
      // opaque square and rounds its own corners, so there is nothing to back
      // it with or clip it to.
      icons = (
        <Fragment>
          <Container position="absolute" top="0" left="0">
            <PlatformIcon
              platform={projectPlatforms[0] ?? ''}
              size={stacked}
              radius={radius}
              aria-hidden
            />
          </Container>
          <Container
            position="absolute"
            top={`${stackedOffset}px`}
            left={`${stackedOffset}px`}
          >
            <PlatformIcon
              platform={projectPlatforms[1] ?? ''}
              size={stacked}
              radius={radius}
              aria-hidden
            />
          </Container>
        </Fragment>
      );
  }

  return (
    <Stack
      flexShrink={0}
      justify="center"
      align="center"
      width={`${frame}px`}
      height={`${frame}px`}
      position="relative"
      aria-hidden="true"
    >
      {icons}
    </Stack>
  );
}
