import highlightFuseMatches, {getFuseMatches} from 'app/utils/highlightFuseMatches';

describe('highlightFuseMatches', function() {
  const matchObj = {
    value: 'Authentication tokens allow you to perform actions',
    indices: [
      [4, 6],
      [12, 13],
      [15, 16],
    ],
  };

  it('handles no matches', function() {
    expect(getFuseMatches({value: 'My long string', indices: []})).toEqual([
      {highlight: false, text: 'My long string'},
    ]);
  });

  it('gets the correct tokens', function() {
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

  it('renders a highlighted string', function() {
    // eslint-disable-next-line sentry/no-to-match-snapshot
    expect(highlightFuseMatches(matchObj)).toMatchSnapshot();
  });

  it('matches whole word', function() {
    // eslint-disable-next-line sentry/no-to-match-snapshot
    expect(highlightFuseMatches({value: 'foo', indices: [[0, 2]]})).toMatchSnapshot();
  });
});
