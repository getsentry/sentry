import type {ReactNode} from 'react';
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
}

/**
 * A replay's OS or browser, drawn as the platform icon. Shared between the
 * replays table and the Seer `replaysQuery` embed so the two can't drift.
 */
export function ReplayPlatformIcon({children, name, version}: Props) {
  if (!name && !version) {
    return (
      <Tooltip title={t('N/A')}>
        <Flex justify="center" width="20px">
          <IconNot size="xs" variant="muted" />
        </Flex>
        {children}
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${name ?? t('Unknown')} ${version ?? ''}`.trim()}>
      <PlatformIcon
        platform={generatePlatformIconName(name ?? '', version ?? undefined)}
        size="20px"
      />
      {children}
    </Tooltip>
  );
}

/**
 * A replay's OS and the browser it ran in, side by side, so a narrow table can
 * spend one column on both.
 *
 * A mobile replay has no browser, so it shows its OS alone rather than pairing
 * the icon with an "N/A" marker.
 */
export function ReplayPlatformIcons({
  browser,
  os,
}: {
  browser: PlatformValue;
  os: PlatformValue;
}) {
  const hasBrowser = Boolean(browser.name || browser.version);

  return (
    <Flex align="center" gap="xs">
      <ReplayPlatformIcon name={os.name} version={os.version} />
      {hasBrowser ? (
        <ReplayPlatformIcon name={browser.name} version={browser.version} />
      ) : null}
    </Flex>
  );
}
