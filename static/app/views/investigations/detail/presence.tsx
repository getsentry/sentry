import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {CollapsedAvatars, UserAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {userDisplayName} from 'sentry/utils/formatters';
import {
  memberUsersQueryOptions,
  normalizeMemberValues,
} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import {investigationPresenceQueryOptions} from 'sentry/views/investigations/api';

const MAX_VISIBLE = 6;

/** Sends heartbeats at the interval the backend returns, while the tab is visible. */
function useInvestigationPresence(investigationId: string, limit: number) {
  const organization = useOrganization();
  const {data} = useQuery({
    ...investigationPresenceQueryOptions(organization.slug, investigationId, limit),
    refetchInterval: query => query.state.data?.json.heartbeatIntervalMs ?? false,
    refetchIntervalInBackground: false,
  });
  return {viewers: data?.viewers ?? [], total: data?.total ?? 0};
}

/**
 * Everyone else who has opened the investigation: active viewers highlighted,
 * earlier ones faded. Renders nothing, not even `separator`, when there is nobody.
 */
export function InvestigationViewers({
  investigationId,
  separator,
}: {
  investigationId: string;
  separator?: ReactNode;
}) {
  const organization = useOrganization();
  const {viewers, total} = useInvestigationPresence(investigationId, MAX_VISIBLE);
  // The heartbeat returns ids only; users are fetched again only when the set changes.
  const {data: members = []} = useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      ids: normalizeMemberValues(viewers.map(viewer => viewer.userId)),
    }),
    enabled: viewers.length > 0,
    placeholderData: keepPreviousData,
  });
  const membersById = new Map(members.map(member => [member.id, member]));
  const shown = viewers.flatMap(viewer => {
    const user = membersById.get(viewer.userId);
    return user ? [{...viewer, user}] : [];
  });

  if (shown.length === 0) {
    return null;
  }

  return (
    <Fragment>
      {separator}
      <Flex align="center" gap="xs">
        <Flex align="center">
          {shown.map(({user, active, lastSeen}, index) => (
            // Stacked like AvatarList; the first (most recent) viewer is on top.
            <ViewerAvatar key={user.id} active={active} stackOrder={shown.length - index}>
              <UserAvatar
                user={user}
                size={24}
                hasTooltip
                tooltipOptions={{position: 'bottom'}}
                renderTooltip={() =>
                  active
                    ? t('%s is viewing now', userDisplayName(user, false))
                    : tct('[name] viewed [time]', {
                        name: userDisplayName(user, false),
                        time: <TimeSince date={lastSeen} />,
                      })
                }
              />
            </ViewerAvatar>
          ))}
        </Flex>
        {total > viewers.length ? (
          <Tooltip title={t('%s other viewers', total - viewers.length)}>
            <CollapsedAvatars>+{total - viewers.length}</CollapsedAvatars>
          </Tooltip>
        ) : null}
      </Flex>
    </Fragment>
  );
}

// Stacked like AvatarList. Each avatar sits on a solid backing in the page color, so
// overlapping avatars never show through each other. Active viewers get a green
// ring; earlier ones fade on that backing.
const ViewerAvatar = styled('span')<{active: boolean; stackOrder: number}>`
  position: relative;
  z-index: ${p => p.stackOrder};
  display: inline-flex;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.primary};
  /* A transparent border shows the backing, as a ring in the page color. */
  border: 2px solid
    ${p => (p.active ? p.theme.tokens.border.success.vibrant : 'transparent')};

  &:not(:first-child) {
    margin-left: -6px;
  }

  > * {
    opacity: ${p => (p.active ? 1 : 0.5)};
    transition: opacity 0.3s;
  }

  &:hover {
    z-index: ${p => p.stackOrder + 100};

    > * {
      opacity: 1;
    }
  }
`;
