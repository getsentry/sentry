import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

describe('SQLishFormatter', function () {
  const formatter = new SQLishFormatter();

  it('Formats basic SQL', () => {
    expect(formatter.toString('SELECT hello;')).toEqual('SELECT hello;');
  });

  it('Formats wildcards', () => {
    expect(formatter.toString('SELECT *;')).toEqual('SELECT *;');
  });

  it('Formats equality', () => {
    expect(formatter.toString('SELECT * FROM users WHERE age = 10;')).toEqual(
      'SELECT * \nFROM users \nWHERE age = 10;'
    );
  });

  it('Formats comparisons', () => {
    expect(
      formatter.toString('SELECT * FROM users WHERE age > 10 AND age < 20;')
    ).toEqual('SELECT * \nFROM users \nWHERE age > 10 \nAND age < 20;');
  });

  it('Formats lists of bare column names', () => {
    expect(formatter.toString('SELECT id, name;')).toEqual('SELECT id, name;');
  });

  it('Format PHP-style parameters', () => {
    expect(
      formatter.toString(
        'SELECT * FROM messages WHERE (receiver_user_id = Users.id AND created >= :c1))'
      )
    ).toEqual(
      'SELECT * \nFROM messages \nWHERE (receiver_user_id = Users.id \nAND created >= :c1))'
    );
  });

  it('Adds newlines for keywords', () => {
    expect(
      formatter.toString('SELECT hello FROM users ORDER BY name DESC LIMIT 1;')
    ).toEqual('SELECT hello \nFROM users \nORDER BY name DESC \nLIMIT 1;');
  });
});
