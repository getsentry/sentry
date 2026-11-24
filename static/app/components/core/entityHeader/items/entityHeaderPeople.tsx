import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {AvatarList} from '@sentry/scraps/avatar';
import {ROW_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarUser} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';

export interface EntityHeaderPeopleProps {
  /**
   * How these people relate to the entity, such as "Viewed by" or
   * "Participants". Required because the avatars alone don't say what they
   * represent. It starts the text a screen reader reads in place of the
   * avatars.
   */
  label: string;
  /**
   * The people to show. With an empty array, the slot renders nothing.
   */
  users: AvatarUser[];
  /**
   * Separate from the header's `isLoading`, because people usually come from a
   * different request than the entity.
   */
  isLoading?: boolean;
  /**
   * How many avatars to draw before the rest collapse into an overflow chip.
   * Everyone is still named to a screen reader, whatever the limit.
   *
   * @default 5
   */
  maxVisibleAvatars?: number;
}

export function EntityHeaderPeople({
  isLoading,
  label,
  maxVisibleAvatars = 5,
  users,
}: EntityHeaderPeopleProps) {
  if (!isLoading && users.length === 0) {
    return null;
  }

  // Screen readers get the people as text, not as a group of images.
  //
  // An uploaded avatar is an `img` named after the person. A letter avatar is a
  // `span` with a `title` and an SVG of initials, which is not a reliable name.
  // Most people have no uploaded avatar, so the avatars were announced as
  // single letters. The avatars are also not focusable, so their tooltips and
  // the overflow chip were mouse-only.
  //
  // Listing every name as text fixes these problems, and does not depend on a
  // screen reader announcing a `group` role.
  const names = users.map(user => userDisplayName(user, false)).join(', ');

  return (
    <Flex align="center" height={ROW_HEIGHT} flexShrink={0}>
      {isLoading ? (
        <Placeholder width="40px" height="24px" />
      ) : (
        <Fragment>
          <VisuallyHidden>{`${label}: ${names}`}</VisuallyHidden>
          {/*
            Hidden because the names are already read above. Otherwise a
            screen reader reads the names and then the initials.
          */}
          <Flex aria-hidden>
            <AvatarList
              users={users}
              avatarSize={24}
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
