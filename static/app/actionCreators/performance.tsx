import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import parseLinkHeader from 'app/utils/parseLinkHeader';

type KeyTransaction = {
  project_id: string;
  transaction: string;
};

type TeamKeyTransaction = {
  team: string;
  count: number;
  keyed: KeyTransaction[];
};

export type TeamKeyTransactions = TeamKeyTransaction[];

export async function fetchLegacyKeyTransactionsCount(orgSlug): Promise<number> {
  const api = new Client();
  const url = `/organizations/${orgSlug}/legacy-key-transactions-count/`;

  const [data] = await api.requestPromise(url, {
    method: 'GET',
    includeAllArgs: true,
  });
  return data.keyed;
}

export async function fetchTeamKeyTransactions(
  api: Client,
  orgSlug: string,
  teams: string[],
  projects?: string[]
): Promise<TeamKeyTransaction[]> {
  const url = `/organizations/${orgSlug}/key-transactions-list/`;

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

      const [data, , xhr] = await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: payload,
      });

      datas.push(data);

      const pageLinks = xhr && xhr.getResponseHeader('Link');
      if (pageLinks) {
        const paginationObject = parseLinkHeader(pageLinks);
        hasMore = paginationObject?.next?.results ?? false;
        cursor = paginationObject.next?.cursor;
      } else {
        hasMore = false;
      }
    } catch (err) {
      addErrorMessage(
        err.responseJSON?.detail ?? t('Error fetching team key transactions')
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
  addLoadingMessage(t('Saving changes\u2026'));

  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/key-transactions/`,
    {
      method: isKeyTransaction ? 'DELETE' : 'POST',
      query: {
        project: projects.map(id => String(id)),
      },
      data: {
        transaction: transactionName,
        team: teamIds,
      },
    }
  );

  promise.then(clearIndicators);

  promise.catch(response => {
    const responseJSON = response?.responseJSON;
    const errorDetails = responseJSON?.detail ?? responseJSON?.non_field_errors;

    if (Array.isArray(errorDetails) && errorDetails.length && errorDetails[0]) {
      addErrorMessage(errorDetails[0]);
    } else {
      addErrorMessage(errorDetails ?? t('Unable to update key transaction'));
    }
  });

  return promise;
}
