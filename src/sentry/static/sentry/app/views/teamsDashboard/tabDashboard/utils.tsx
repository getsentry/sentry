import {DashboardData} from './types';

export function generateRandomId() {
  return Math.random()
    .toString(36)
    .substring(7);
}

export function getDevData(): DashboardData {
  return {
    cards: [
      {
        columnSpan: 1,
        data: {
          id: generateRandomId(),
          kind: 'performance',
          transactionName: '/api/0/organizations/{organization_slug}/eventsv2/',
          projectId: 1,
          apdex: 0.85,
          userMisery: 0.23,
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
    ],
  };
}
