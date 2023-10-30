import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';

type Props = {
  api: Client;
  orgSlug: string;
  projectSlug: string;
  query: string;
  replayId: string;
};

type NodeMarker = {
  node_id: number;
  timestamp: string;
};

async function fetchReplayClicks({api, orgSlug, projectSlug, query, replayId}: Props) {
  const path = `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/clicks/`;
  try {
    const [{data}, _textStatus, resp] = await api.requestPromise(path, {
      includeAllArgs: true,
      query: {
        query,
      },
    });

    const pageLinks = resp?.getResponseHeader('Link') ?? '';

    return {
      fetchError: undefined,
      pageLinks,
      clicks: data as NodeMarker[],
    };
  } catch (error) {
    Sentry.captureException(error);
    return {
      fetchError: error,
      pageLinks: null,
      clicks: [],
    };
  }
}

export default fetchReplayClicks;
