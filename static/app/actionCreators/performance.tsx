import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import parseLinkHeader from 'app/utils/parseLinkHeader';

type TeamKeyTransaction = {
  team: string;
  count: number;
  keyed: {
    project_id: string;
    transaction: string;
  }[];
};

export async function fetchTeamKeyTransactions(
  api: Client,
  orgSlug: string,
  teams: string[],
  projects?: string[]
): Promise<TeamKeyTransaction[]> {
  const url = `/organizations/${orgSlug}/key-transactions-list/`;

  const datas: TeamKeyTransaction[][] = [];
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
  projects: Readonly<number[]>,
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
    const non_field_errors = response?.responseJSON?.non_field_errors;

    if (
      Array.isArray(non_field_errors) &&
      non_field_errors.length &&
      non_field_errors[0]
    ) {
      addErrorMessage(response.responseJSON.non_field_errors[0]);
    } else {
      addErrorMessage(t('Unable to update key transaction'));
    }
  });

  return promise;
}
