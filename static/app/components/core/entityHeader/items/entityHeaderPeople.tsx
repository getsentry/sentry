import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {AvatarList} from '@sentry/scraps/avatar';
import {ROW_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarUser} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';

const AVATAR_SIZE = 24;

export interface EntityHeaderPeopleProps {
  /**
   * How these people relate to the entity, e.g. "Viewed by" or "Participants".
   * Required because a stack of faces says nothing on its own — it heads the
   * text a screen reader reads in place of the stack.
   */
  label: string;
  /**
   * The people themselves. Pass an empty array for "nobody yet" — the slot then
   * renders nothing.
   */
  users: AvatarUser[];
  /**
   * Independent of the header's `isLoading`: these usually load on their own
   * schedule, separate from the entity.
   */
  isLoading?: boolean;
  /**
   * Width of the skeleton. Defaults to the width of a two-avatar stack.
   */
  loadingWidth?: string;
  maxVisibleAvatars?: number;
}

export function EntityHeaderPeople({
  isLoading,
  label,
  loadingWidth = '40px',
  maxVisibleAvatars = 5,
  users,
}: EntityHeaderPeopleProps) {
  if (!isLoading && users.length === 0) {
    return null;
  }

  // The stack is read as text, not as a group of images.
  //
  // An uploaded avatar reaches the accessibility tree as an `img` with the
  // person's name; a letter avatar reaches it as a `span` with a `title` and an
  // svg of initials, which is not a reliable name. Most people have no uploaded
  // avatar, so the stack announced as a run of single letters. The avatars are
  // not focusable either, so their tooltips were mouse-only and the overflow
  // chip was unreachable by anyone.
  //
  // Naming everyone here fixes all three at once, and does not depend on a
  // screen reader announcing a `group` role.
  const names = users.map(user => userDisplayName(user, false)).join(', ');

  return (
    <Flex align="center" height={ROW_HEIGHT} flexShrink={0}>
      {isLoading ? (
        <Placeholder width={loadingWidth} height={`${AVATAR_SIZE}px`} />
      ) : (
        <Fragment>
          <VisuallyHidden>{`${label}: ${names}`}</VisuallyHidden>
          {/*
            Decorative once the names are spoken above — otherwise a screen
            reader reads the list and then the initials behind it.
          */}
          <Flex aria-hidden>
            <AvatarList
              users={users}
              avatarSize={AVATAR_SIZE}
              maxVisibleAvatars={maxVisibleAvatars}
              renderTooltip={user => (
                <Fragment>
                  <Tooltip.Header>{label}</Tooltip.Header>
                  <Tooltip.Grid>
                    <Tooltip.Row>{userDisplayName(user)}</Tooltip.Row>
                  </Tooltip.Grid>
                </Fragment>
              )}
            />
          </Flex>
        </Fragment>
      )}
    </Flex>
  );
}
