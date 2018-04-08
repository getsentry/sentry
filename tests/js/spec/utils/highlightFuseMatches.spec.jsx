import {getFuseMatches} from 'app/utils/highlightFuseMatches';

describe('highlightFuseMatches', function() {
  it('gets the correct tokens', function() {
    expect(
      getFuseMatches({
        value: 'Authentication tokens allow you to perform actions',
        indices: [[4, 6], [12, 13], [15, 16]],
      })
    ).toEqual([
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
});
