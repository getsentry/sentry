import {useCallback, useMemo} from 'react';
import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import fetchReplayList, {
  DEFAULT_SORT,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Opts = {
  user: undefined | ReplayRecord['user'];
};

function getUserCondition(user: undefined | ReplayRecord['user']) {
  if (user?.id) {
    return `user.id:${user.id}`;
  }
  if (user?.email) {
    return `user.email:${user.email}`;
  }
  if (user?.ip) {
    return `user.ipAddress:${user.ip}`;
  }
  return '';
}

function useLoadReplaysFromUser({user}: Opts) {
  const api = useApi();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = getUserCondition(user);
    if (!query) {
      return undefined;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [],
      query,
      orderby: DEFAULT_SORT,
    });
  }, [user]);

  const loadRows = useCallback(
    async ({stopIndex, startIndex}) => {
      if (!eventView) {
        throw new Error('Missing eventView');
      }
      const perPage = String(stopIndex - startIndex);
      const {fetchError, replays: responseData} = await fetchReplayList({
        api,
        eventView,
        location: {
          query: {
            per_page: perPage,
            cursor: `0:${startIndex}:0`,
          },
        } as Location<{
          cursor: string;
          per_page: string;
        }>,
        organization,
      });
      if (fetchError) {
        throw fetchError;
      }
      return responseData || [];
    },
    [api, eventView, organization]
  );

  return {
    eventView,
    loadRows,
  };
}

export default useLoadReplaysFromUser;
