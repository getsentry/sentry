import {Achievement} from 'app/types';

const earned: Array<Achievement> = [
  {
    id: '1',
    type: 'team-is-growing',
    dateUnlock: String(new Date()),
  },
  {
    id: '2',
    type: 'sent-first-event',
    dateUnlock: String(new Date()),
  },
  {
    id: '3',
    type: 'transactions-are-alive',
    dateUnlock: String(new Date()),
  },
  {
    id: '4',
    type: 'sent-one-million-errors',
    dateUnlock: String(new Date()),
  },
  {
    id: '5',
    type: 'everything-is-broke',
    dateUnlock: String(new Date()),
  },
];

const locked: Array<Achievement> = [
  {
    id: '1',
    type: 'we-knew-you-could-do-it',
    dateUnlock: String(new Date()),
  },
  {
    id: '2',
    type: 'ten-gb-sent',
    dateUnlock: String(new Date()),
  },
  {
    id: '3',
    type: 'first-transaction',
    dateUnlock: String(new Date()),
  },
];

const all: Array<Achievement> = [...earned, ...locked].map((ach, index) => ({
  ...ach,
  id: String(index),
}));

export {all, earned, locked};
