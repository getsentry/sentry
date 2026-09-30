import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
export function useInvestigationPresence(investigationId: string, limit: number) {
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
      <Flex align="center">
        {shown.map(({user, active, lastSeen}) => (
          <ViewerAvatar key={user.id} active={active}>
            <UserAvatar
              user={user}
              size={22}
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
        {total > viewers.length ? (
          <Text variant="muted" size="sm">
            +{total - viewers.length}
          </Text>
        ) : null}
      </Flex>
    </Fragment>
  );
}

const ViewerAvatar = styled('span')<{active: boolean}>`
  display: inline-flex;
  border-radius: 50%;
  margin-right: ${p => p.theme.space['2xs']};
  border: 2px solid
    ${p => (p.active ? p.theme.tokens.border.success.vibrant : 'transparent')};
  opacity: ${p => (p.active ? 1 : 0.45)};
  transition: opacity 0.3s;
`;
