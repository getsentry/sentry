import {Fragment} from 'react';
import {PlatformIcon} from 'platformicons';

import type {ContainerProps} from '@sentry/scraps/layout';
import {Container, Stack} from '@sentry/scraps/layout';

import {IconAllProjects, IconMyProjects} from 'sentry/icons';

type ProjectsBadgeSize = 'md' | 'lg';

/**
 * Geometry per size, read off the spec frames rather than scaled from the
 * edge: the two sizes do not share one ratio, and at `md` the contents fill
 * the frame while at `lg` they sit inside it.
 *
 * `tile` is the single platform icon, centred in the frame. `stacked` is each
 * of the two overlapping icons, which start at opposite corners — so their
 * offset is whatever the frame has left over.
 */
const SIZES = {
  md: {frame: 16, tile: 16, stacked: 10.5, radius: '2xs'},
  lg: {frame: 24, tile: 20, stacked: 16, radius: 'sm'},
} as const satisfies Record<
  ProjectsBadgeSize,
  {frame: number; radius: ContainerProps['radius']; stacked: number; tile: number}
>;

export interface ProjectsBadgeProps {
  /**
   * Platform slugs for the project(s) to display.
   * - 0 entries: renders an all-projects or my-projects icon
   * - 1 entry: renders a single bordered platform icon
   * - 2+ entries: renders two stacked platform icons (top-left + bottom-right)
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
 * One platform's icon, in the rounded tile the spec draws it in.
 *
 * The image is drawn at the tile's full size and positioned a pixel outside
 * the content box, so the border sits over its edge rather than around it.
 */
function PlatformTile({
  platform,
  radius,
  size,
  ...position
}: {
  platform: string;
  radius: ContainerProps['radius'];
  size: number;
} & Pick<ContainerProps, 'top' | 'left' | 'bottom' | 'right'>) {
  return (
    <Container
      position="absolute"
      width={`${size}px`}
      height={`${size}px`}
      overflow="hidden"
      radius={radius}
      border="muted"
      background="primary"
      {...position}
    >
      <Container position="absolute" top="-1px" left="-1px">
        <PlatformIcon platform={platform} size={size} aria-hidden />
      </Container>
    </Container>
  );
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
  const {frame, tile, stacked, radius} = SIZES[size];
  const stackedOffset = frame - stacked;

  let icons: React.ReactNode;

  switch (projectPlatforms.length) {
    case 0: {
      const Icon = allProjects ? IconAllProjects : IconMyProjects;
      icons =
        size === 'md' ? (
          <Icon size="md" aria-hidden="true" />
        ) : (
          <Icon legacySize={`${tile}px`} aria-hidden="true" />
        );
      break;
    }

    case 1:
      icons = (
        <PlatformTile platform={projectPlatforms[0] ?? ''} size={tile} radius={radius} />
      );
      break;

    default:
      icons = (
        <Fragment>
          <PlatformTile
            platform={projectPlatforms[0] ?? ''}
            size={stacked}
            radius={radius}
            top="0"
            left="0"
          />
          <PlatformTile
            platform={projectPlatforms[1] ?? ''}
            size={stacked}
            radius={radius}
            top={`${stackedOffset}px`}
            left={`${stackedOffset}px`}
          />
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
