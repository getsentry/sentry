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

  it('Formats lists of bare column names', () => {
    expect(formatter.toString('SELECT id, name FROM sentry_organization;')).toEqual(
      'SELECT id, name \nFROM sentry_organization;'
    );
  });
});
