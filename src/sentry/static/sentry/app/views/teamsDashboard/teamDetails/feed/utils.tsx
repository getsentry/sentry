import {NewQuery, Project, Organization} from 'app/types';
import {getPrebuiltQueries} from 'app/views/eventsV2/utils';

import {DashboardData} from './types';

export function generateRandomId() {
  return Math.random()
    .toString(36)
    .substring(7);
}

export function getDevData(
  projects: Project[],
  organization: Organization,
  keyTransactions: any[]
): DashboardData {
  const projectIds = projects.map(proj => parseInt(proj.id, 10));
  const prebuiltQueries: NewQuery[] = getPrebuiltQueries(organization).map(query => ({
    ...query,
    projects: projectIds,
  }));

  return {
    cards: [
      {
        columnSpan: 1,
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 1,
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 1,
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 2,
        type: 'issueList',
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 1,
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 3,
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 1,
        data: {
          id: generateRandomId(),
        },
      },
      {
        columnSpan: 2,
        data: {
          id: generateRandomId(),
        },
      },
      ...prebuiltQueries.map(query => ({
        columnSpan: 1,
        type: 'discover',
        data: query,
      })),
      ...keyTransactions
        .filter(transaction => projectIds.includes(transaction['project.id']))
        .map(transaction => ({
          columnSpan: 1,
          type: 'performance',
          data: {
            transaction: transaction.transaction,
            project: transaction.project,
            projectId: transaction['project.id'],
            apdex: transaction.apdex_300,
            userMisery: transaction.user_misery_300,
          },
        })),
    ],
  };
}
