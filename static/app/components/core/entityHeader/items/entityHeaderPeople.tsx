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

export interface EntityHeaderPeopleProps {
  /**
   * How these people relate to the entity, e.g. "Viewed by" or "Participants".
   * Required because a stack of faces says nothing on its own — it becomes the
   * header of each avatar's tooltip.
   */
  label: string;
  /**
   * The people themselves. Pass an empty array for "nobody yet" — the slot then
   * renders nothing.
   */
  users: AvatarUser[];
  /**
   * What to call them in the overflow chip, e.g. "viewers" gives "+3 other
   * viewers". Defaults to "people".
   */
  collectiveNoun?: string;
  /**
   * These usually load on their own schedule, separate from the entity, so this
   * is independent of the header's `isLoading`.
   */
  isLoading?: boolean;
  /**
   * Width of the skeleton. Defaults to the width of a two-avatar stack.
   */
  loadingWidth?: string;
  maxVisibleAvatars?: number;
}

export function EntityHeaderPeople({
  collectiveNoun,
  isLoading,
  label,
  loadingWidth = '40px',
  maxVisibleAvatars = 5,
  users,
}: EntityHeaderPeopleProps) {
  const {t} = useTranslation();

  if (!isLoading && users.length === 0) {
    return null;
  }

  return (
    // The stack needs the label programmatically, not only inside a hover
    // tooltip: the avatars are not focusable, so a tooltip alone is mouse-only
    // and a screen reader hears an unexplained run of initials.
    <Flex
      align="center"
      height={ROW_HEIGHT}
      flexShrink={0}
      role="group"
      aria-label={label}
    >
      {isLoading ? (
        <Placeholder width={loadingWidth} height={`${AVATAR_SIZE}px`} />
      ) : (
        <AvatarList
          users={users}
          avatarSize={AVATAR_SIZE}
          maxVisibleAvatars={maxVisibleAvatars}
          // A bare stack of faces does not say what it represents, so both the
          // per-avatar tooltip and the overflow chip name the relationship.
          // Without this the chip reads "+3 other users", AvatarList's default.
          typeAvatars={collectiveNoun ?? t('people')}
          renderTooltip={user => (
            <Fragment>
              <Tooltip.Header>{label}</Tooltip.Header>
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
