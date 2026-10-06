import {Fragment} from 'react';

import {AvatarList} from '@sentry/scraps/avatar';
import {ROW_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarUser} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';

/** Matches the spec's overlapping 24px stack. */
const AVATAR_SIZE = 24;

export interface EntityHeaderViewersProps {
  /**
   * People who have looked at this entity. Rendered as an overlapping avatar
   * stack at the head of the stats row. Pass an empty array for "nobody yet" —
   * the slot then renders nothing.
   */
  users: AvatarUser[];
  /**
   * Viewers usually load on their own schedule, separate from the entity, so
   * this is independent of the header's `isLoading`.
   */
  isLoading?: boolean;
  /**
   * Width of the skeleton. Defaults to the width of a two-avatar stack.
   */
  loadingWidth?: string;
  maxVisibleAvatars?: number;
}

export function EntityHeaderViewers({
  isLoading,
  loadingWidth = '40px',
  maxVisibleAvatars = 5,
  users,
}: EntityHeaderViewersProps) {
  const {t} = useTranslation();

  if (!isLoading && users.length === 0) {
    return null;
  }

  return (
    <Flex align="center" height={ROW_HEIGHT} flexShrink={0}>
      {isLoading ? (
        <Placeholder width={loadingWidth} height={`${AVATAR_SIZE}px`} />
      ) : (
        <AvatarList
          users={users}
          avatarSize={AVATAR_SIZE}
          maxVisibleAvatars={maxVisibleAvatars}
          // A bare stack of faces does not say what it represents, so both the
          // per-avatar tooltip and the overflow chip name it. Without this the
          // chip reads "+3 other users", which says nothing about viewing.
          typeAvatars={t('viewers')}
          renderTooltip={user => (
            <Fragment>
              <Tooltip.Header>{t('Viewed by')}</Tooltip.Header>
              <Tooltip.Grid>
                <Tooltip.Row>{userDisplayName(user)}</Tooltip.Row>
              </Tooltip.Grid>
            </Fragment>
          )}
        />
      )}
    </Flex>
  );
}
