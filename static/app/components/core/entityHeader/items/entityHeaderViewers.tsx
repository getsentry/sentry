import {AvatarList} from '@sentry/scraps/avatar';
import {ROW_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarUser} from 'sentry/types/user';

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
        />
      )}
    </Flex>
  );
}
