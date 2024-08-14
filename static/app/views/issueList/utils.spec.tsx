import type {TagValue} from 'sentry/types/group';
import {mergeAndSortTagValues} from 'sentry/views/issueDetails/utils';

import {getTabs} from './utils';

describe('getTabs', () => {
  it('displays the correct list of tabs', () => {
    expect(getTabs().filter(tab => !tab[1].hidden)).toEqual([
      [
        'is:unresolved issue.priority:[high, medium]',
        expect.objectContaining({name: 'Prioritized'}),
      ],
      [
        'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
        expect.objectContaining({name: 'For Review'}),
      ],
      ['is:regressed', expect.objectContaining({name: 'Regressed'})],
      ['is:escalating', expect.objectContaining({name: 'Escalating'})],
      ['is:archived', expect.objectContaining({name: 'Archived'})],
      ['is:reprocessing', expect.objectContaining({name: 'Reprocessing'})],
    ]);
  });

  it('merges and sorts tagValues by count correctly', () => {
    const defaultTagValueFields = {
      email: '',
      id: '',
      name: '',
      username: '',
      ip_address: '',
    };
    const tagValues1: TagValue[] = [
      {
        value: 'a',
        count: 1,
        lastSeen: '2021-01-01T00:00:00',
        firstSeen: '2021-01-01T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'b',
        count: 1,
        lastSeen: '2021-01-02T00:00:00',
        firstSeen: '2021-01-02T00:00:00',
        ...defaultTagValueFields,
      },
    ];

    const tagValues2: TagValue[] = [
      {
        value: 'a',
        count: 1,
        lastSeen: '2021-01-01T00:00:00',
        firstSeen: '2021-01-01T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'c',
        count: 3,
        lastSeen: '2021-01-03T00:00:00',
        firstSeen: '2021-01-03T00:00:00',
        ...defaultTagValueFields,
      },
    ];
    const sortByCount = mergeAndSortTagValues(tagValues1, tagValues2, 'count');
    expect(sortByCount).toEqual([
      {
        value: 'c',
        count: 3,
        lastSeen: '2021-01-03T00:00:00',
        firstSeen: '2021-01-03T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'a',
        count: 2,
        lastSeen: '2021-01-01T00:00:00',
        firstSeen: '2021-01-01T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'b',
        count: 1,
        lastSeen: '2021-01-02T00:00:00',
        firstSeen: '2021-01-02T00:00:00',
        ...defaultTagValueFields,
      },
    ]);
  });

  it('merges and sorts tagValues by lastSeen correctly', () => {
    const defaultTagValueFields = {
      email: '',
      id: '',
      name: '',
      username: '',
      ip_address: '',
    };
    const tagValues1: TagValue[] = [
      {
        value: 'a',
        count: 1,
        lastSeen: '2021-01-01T00:00:00',
        firstSeen: '2021-01-01T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'b',
        count: 1,
        lastSeen: '2021-01-02T00:00:00',
        firstSeen: '2021-01-02T00:00:00',
        ...defaultTagValueFields,
      },
    ];

    const tagValues2: TagValue[] = [
      {
        value: 'a',
        count: 1,
        lastSeen: '2021-01-01T00:00:00',
        firstSeen: '2021-01-01T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'c',
        count: 3,
        lastSeen: '2021-01-03T00:00:00',
        firstSeen: '2021-01-03T00:00:00',
        ...defaultTagValueFields,
      },
    ];

    const sortByLastSeen = mergeAndSortTagValues(tagValues1, tagValues2, 'lastSeen');
    expect(sortByLastSeen).toEqual([
      {
        value: 'c',
        count: 3,
        lastSeen: '2021-01-03T00:00:00',
        firstSeen: '2021-01-03T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'b',
        count: 1,
        lastSeen: '2021-01-02T00:00:00',
        firstSeen: '2021-01-02T00:00:00',
        ...defaultTagValueFields,
      },
      {
        value: 'a',
        count: 2,
        lastSeen: '2021-01-01T00:00:00',
        firstSeen: '2021-01-01T00:00:00',
        ...defaultTagValueFields,
      },
    ]);
  });
});
