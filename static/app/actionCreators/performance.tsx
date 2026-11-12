import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {RequestError} from 'sentry/utils/requestError/requestError';

type KeyTransaction = {
  project_id: string;
  transaction: string;
};

type TeamKeyTransaction = {
  count: number;
  keyed: KeyTransaction[];
  team: string;
};

export type TeamKeyTransactions = TeamKeyTransaction[];

export async function fetchTeamKeyTransactions(
  api: Client,
  orgSlug: string,
  teams: string[],
  projects?: string[]
): Promise<TeamKeyTransaction[]> {
  const url = getApiUrl('/organizations/$organizationIdOrSlug/key-transactions-list/', {
    path: {organizationIdOrSlug: orgSlug},
  });

  const datas: TeamKeyTransactions[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const payload = {cursor, team: teams, project: projects};
      if (!payload.cursor) {
        delete payload.cursor;
      }
      if (!payload.project?.length) {
        delete payload.project;
      }

      const [data, , resp] = await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: payload,
      });

      datas.push(data);

      const pageLinks = resp?.getResponseHeader('Link');
      if (pageLinks) {
        const paginationObject = parseLinkHeader(pageLinks);
        hasMore = paginationObject?.next?.results ?? false;
        cursor = paginationObject.next?.cursor;
      } else {
        hasMore = false;
      }
    } catch (err: any) {
      const detail: unknown = err.responseJSON?.detail;
      toast.error(
        typeof detail === 'string' ? detail : t('Error fetching team key transactions')
      );
      throw err;
    }
  }

  return datas.flat();
}

export function toggleKeyTransaction(
  api: Client,
  isKeyTransaction: boolean,
  orgId: string,
  projects: string[],
  transactionName: string,
  teamIds?: string[] // TODO(txiao): make this required
): Promise<undefined> {
  toast.loading(t('Saving changes\u2026'));

  const promise: Promise<undefined> = api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/key-transactions/', {
      path: {organizationIdOrSlug: orgId},
    }),
    {
      method: isKeyTransaction ? 'DELETE' : 'POST',
      query: {
        project: projects.map(String),
      },
      data: {
        transaction: transactionName,
        team: teamIds,
      },
    }
  );

  promise.then(() => toast.dismiss());

  promise.catch(response => {
    if (response instanceof RequestError) {
      const responseJSON = response?.responseJSON;
      const errorDetails = responseJSON?.detail ?? responseJSON?.non_field_errors;

      if (Array.isArray(errorDetails) && typeof errorDetails[0] === 'string') {
        toast.error(errorDetails[0]);
      } else if (typeof errorDetails === 'string') {
        toast.error(errorDetails);
      } else {
        toast.error(t('Unable to update key transaction'));
      }
    }
  });

  return promise;
}
