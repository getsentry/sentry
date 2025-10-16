import styled from '@emotion/styled';

import type {Fuse} from 'sentry/utils/fuzzySearch';
import highlightFuseMatches, {getFuseMatches} from 'sentry/utils/highlightFuseMatches';

describe('highlightFuseMatches', () => {
  const matchObj: Fuse.FuseResultMatch = {
    value: 'Authentication tokens allow you to perform actions',
    indices: [
      [4, 6],
      [12, 13],
      [15, 16],
    ],
  };
  const Mark = styled('mark')``;

  it('handles no matches', () => {
    expect(getFuseMatches({value: 'My long string', indices: []})).toEqual([
      {highlight: false, text: 'My long string'},
    ]);
  });

  it('gets the correct tokens', () => {
    expect(getFuseMatches(matchObj)).toEqual([
      {
        highlight: false,
        text: 'Auth',
      },
      {
        highlight: true,
        text: 'ent',
      },
      {
        highlight: false,
        text: 'icati',
      },
      {
        highlight: true,
        text: 'on',
      },
      {
        highlight: false,
        text: ' ',
      },
      {
        highlight: true,
        text: 'to',
      },
      {
        highlight: false,
        text: 'kens allow you to perform actions',
      },
    ]);
  });

  it('renders a highlighted string', () => {
    expect(highlightFuseMatches(matchObj, Mark)).toMatchSnapshot();
  });

  it('matches whole word', () => {
    expect(
      highlightFuseMatches({value: 'foo', indices: [[0, 2]]}, Mark)
    ).toMatchSnapshot();
  });
});
