import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

describe('SQLishFormatter', function () {
  const formatter = new SQLishFormatter();

  it('Formats basic SQL', () => {
    expect(formatter.toString('SELECT hello;')).toEqual('SELECT hello;');
  });

  it('Formats wildcards', () => {
    expect(formatter.toString('SELECT *;')).toEqual('SELECT *;');
  });

  it('Formats lists of bare column names', () => {
    expect(formatter.toString('SELECT id, name;')).toEqual('SELECT id, name;');
  });

  it('Adds newlines for keywords', () => {
    expect(formatter.toString('SELECT hello FROM users LIMIT 1;')).toEqual(
      'SELECT hello \nFROM users \nLIMIT 1;'
    );
  });
});
