import {Goal, SelectValue} from 'app/types';

const goals: Array<Goal> = [
  {
    id: '1',
    dateCreated: String(new Date()),
    title: 'Q3 Apdex Goal',
    duedate: String(new Date('September 30, 2020 11:59:59')),
    progress: 30,
    owner: {
      // @ts-ignore
      user: {
        id: '1',
        name: 'Jane Bloggs',
        email: 'janebloggs@example.com',
      },
      inviteStatus: 'requested_to_join',
    },
    transactionName: '/api/0/organizations/{organization_slug}/eventsv2/',
    aggregateObjective: 'apdex(300)',
    description: 'Discover query apdex',
    comparisonOperator: '>=',
    valueObjective: 0.9,
  },
  {
    id: '2',
    dateCreated: String(new Date()),
    title: 'Discover Goals',
    duedate: String(new Date()),
    progress: 30,
    owner: {
      // @ts-ignore
      user: {
        id: '1',
        name: 'Jane Bloggs',
        email: 'janebloggs@example.com',
      },
      inviteStatus: 'requested_to_join',
    },
    transactionName: '/api/0/organizations/{organization_slug}/events*',
    aggregateObjective: 'slo(countStatus(ok),count())',
    description: 'Percent of successful discover queries',
    comparisonOperator: '>=',
    valueObjective: 0.95,
  },
];

const aggregateOptions: Array<SelectValue<string>> = [
  {
    label: 'foo',
    value: 'foo',
  },
  {
    label: 'bar',
    value: 'bar',
  },
];

const comparisonOperatorsOptions: Array<SelectValue<string>> = [
  {
    label: '>',
    value: '>',
  },
  {
    label: '<',
    value: '<',
  },
  {
    label: '>=',
    value: '>=',
  },
  {
    label: '<=',
    value: '<=',
  },
];

export {goals, aggregateOptions, comparisonOperatorsOptions};
