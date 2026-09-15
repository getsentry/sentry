import type {ReactNode} from 'react';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';

interface Props {
  name: null | string;
  version: null | string;
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
