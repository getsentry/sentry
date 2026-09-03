import {SESSION_ID} from '@sentry/conventions/attributes';
import {skipToken, useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {ReplayAccess} from 'sentry/components/replays/replayAccess';
import {IconPlay} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

const REFERRER = 'api.explore.user-session-replays';

interface ReplayIndexResponse {
  data: Array<{id: string}>;
}

/**
 * The replays a session carries, found by the `session.id` tag the SDK stamps on
 * replay events. A session is not guaranteed one replay, so this is a list.
 */
function useSessionReplays(sessionId: string) {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const enabled = isReady && Boolean(sessionId);

  const {data} = useQuery(
    apiOptions.as<ReplayIndexResponse>()('/organizations/$organizationIdOrSlug/replays/', {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        ...normalizeDateTimeParams(selection.datetime),
        project: selection.projects,
        environment: selection.environments,
        field: ['id'],
        // The replay index treats any unknown filter as a tag, so the bare key is
        // correct here — `tags[session.id]` fails to parse and silently returns
        // every replay in the project.
        query: `${SESSION_ID}:"${sessionId}"`,
        sort: '-started_at',
        per_page: 10,
        referrer: REFERRER,
      },
      staleTime: 0,
    })
  );

  return {replayIds: data?.data.map(replay => replay.id) ?? []};
}

/**
 * A link to the session's replays. A single one opens directly; several open the
 * replays list filtered to this session. Kept to a link rather than an embedded
 * player: the detail page is viewport-locked around its timeline, and a ~500px
 * player would crowd the lanes out.
 */
export function SessionReplay({sessionId}: {sessionId: string}) {
  const organization = useOrganization();
  const {replayIds} = useSessionReplays(sessionId);

  if (replayIds.length === 0) {
    return null;
  }

  const to =
    replayIds.length === 1
      ? {pathname: makeReplaysPathname({path: `/${replayIds[0]}/`, organization})}
      : {
          pathname: makeReplaysPathname({path: '/', organization}),
          query: {query: `${SESSION_ID}:"${sessionId}"`},
        };

  return (
    <ReplayAccess>
      <Flex>
        <LinkButton size="sm" icon={<IconPlay size="xs" />} to={to}>
          {replayIds.length === 1
            ? t('Watch replay')
            : tn('%s Replay', '%s Replays', replayIds.length)}
        </LinkButton>
      </Flex>
    </ReplayAccess>
  );
}
