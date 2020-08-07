import {NewQuery, Project, Organization} from 'app/types';
import {getPrebuiltQueries} from 'app/views/eventsV2/utils';

import {FeedData, CardData} from './types';

export function generateRandomId() {
  return Math.random()
    .toString(36)
    .substring(7);
}

export function getDevData(
  projects: Project[],
  organization: Organization,
  keyTransactions: any[]
): FeedData {
  const projectIds = projects.map(proj => parseInt(proj.id, 10));
  const prebuiltQueries: NewQuery[] = getPrebuiltQueries(organization).map(query => ({
    ...query,
    projects: projectIds,
  }));

  return {
    cards: [
      {
        columnSpan: 2,
        type: 'issueList',
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 1,
        type: 'activity',
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 2,
        type: 'releases',
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 1,
        type: 'alerts',
        data: {
          id: generateRandomId(),
        },
      },

      ...prebuiltQueries.reverse().reduce((acc, query, i): CardData => {
        // Show only 3 discover queries for demo so the page flow looks good
        if (i < 3) {
          acc.push({
            columnSpan: 1,
            type: 'discover',
            data: query,
          });
        }
        return acc;
      }, [] as any),

      ...keyTransactions
        .filter(transaction => projectIds.includes(transaction['project.id']))
        .map(
          (transaction): CardData => ({
            columnSpan: 1,
            type: 'performance',
            data: {
              transaction: transaction.transaction,
              project: transaction.project,
              projectId: transaction['project.id'],
              apdex: transaction.apdex_300,
              userMisery: transaction.user_misery_300,
            },
          })
        ),
    ],
  };
}
