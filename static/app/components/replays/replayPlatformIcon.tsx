import type {ReactNode} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';

interface PlatformValue {
  name: null | string;
  version: null | string;
}

interface Props extends PlatformValue {
  /**
   * Rendered next to the icon, inside the tooltip target. The replays table
   * puts its hover-revealed filter menu here; the Seer embed passes nothing,
   * because an embed cell is read-only by construction.
   */
  children?: ReactNode;
  size?: `${number}px`;
}

/**
 * A replay's OS or browser, drawn as the platform icon. Shared between the
 * replays table and the Seer `replaysQuery` embed so the two can't drift.
 */
export function ReplayPlatformIcon({children, name, size = '20px', version}: Props) {
  if (!name && !version) {
    return (
      <Tooltip title={t('N/A')}>
        <Flex justify="center" width={size}>
          <IconNot size="xs" variant="muted" />
        </Flex>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${name ?? t('Unknown')} ${version ?? ''}`.trim()}>
      <PlatformIcon
        platform={generatePlatformIconName(name ?? '', version ?? undefined)}
        size={size}
      />
      {children}
    </Tooltip>
  );
}

/**
 * A replay's OS and browser as one overlapping pair, the way stacked avatars
 * read: the browser tucked behind and to the right of the OS it ran on. Lets a
 * narrow table spend one column on both.
 *
 * A mobile replay has no browser, so it shows its OS alone rather than pairing
 * the icon with an "N/A" marker.
 */
export function ReplayPlatformIconStack({
  browser,
  os,
  size = '16px',
}: {
  browser: PlatformValue;
  os: PlatformValue;
  size?: `${number}px`;
}) {
  if (!browser.name && !browser.version) {
    return <ReplayPlatformIcon name={os.name} version={os.version} size={size} />;
  }

  return (
    <IconStack>
      <StackedIcon>
        <ReplayPlatformIcon name={os.name} version={os.version} size={size} />
      </StackedIcon>
      <StackedIcon>
        <ReplayPlatformIcon name={browser.name} version={browser.version} size={size} />
      </StackedIcon>
    </IconStack>
  );
}

const IconStack = styled('div')`
  display: flex;
  align-items: center;
`;

/**
 * The ring is what keeps the two icons legible where they overlap; without it
 * a dark browser logo bleeds into the OS logo in front of it.
 */
/**
 * A rounded square rather than the circle stacked avatars use: a platform logo
 * is square, and its corners cross the edge of a circle tight enough to sit in
 * a table row.
 */
const StackedIcon = styled('div')`
  display: flex;
  position: relative;
  padding: 2px;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.primary};

  /* The OS leads, and stays in front of what slides under it. */
  &:first-child {
    z-index: 1;
  }

  /* The browser tucks in behind the OS's trailing edge. */
  &:last-child {
    margin-left: -7px;
  }
`;
