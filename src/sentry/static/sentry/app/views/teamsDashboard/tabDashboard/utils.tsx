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
        id: generateRandomId(),
        columnSpan: 1,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 1,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 1,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 2,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 1,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 3,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 1,
        content: null,
      },
      {
        id: generateRandomId(),
        columnSpan: 2,
        content: null,
      },
    ],
  };
}
