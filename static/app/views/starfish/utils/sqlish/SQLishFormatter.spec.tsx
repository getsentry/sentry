import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

describe('SQLishFormatter', function () {
  const formatter = new SQLishFormatter();

  it('Formats basic SQL', () => {
    expect(formatter.toString('SELECT hello FROM users;')).toEqual(
      'SELECT hello \nFROM users;'
    );
  });

  it('Formats wildcards', () => {
    expect(formatter.toString('SELECT * FROM users;')).toEqual('SELECT * \nFROM users;');
  });
});
