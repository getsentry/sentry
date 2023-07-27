import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

describe('SQLishFormatter', function () {
  describe('SQLishFormatter.toString()', () => {
    const formatter = new SQLishFormatter();

    it('Falls back to original string if unable to parse', () => {
      expect(formatter.toString('😤')).toEqual('😤');
    });

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

    it('Formats inequality', () => {
      expect(formatter.toString('SELECT * FROM users WHERE age != 10;')).toEqual(
        'SELECT * \nFROM users \nWHERE age != 10;'
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

    it('Formats backtick columns', () => {
      expect(formatter.toString('SELECT columns AS `tags[column]`)')).toEqual(
        'SELECT columns AS `tags[column]`)'
      );
    });

    it('Formats truncated queries', () => {
      expect(formatter.toString('SELECT id, nam*')).toEqual('SELECT id, nam*');
    });

    it('Formats PHP-style parameters', () => {
      expect(
        formatter.toString(
          'SELECT * FROM messages WHERE (receiver_user_id = Users.id AND created >= :c1))'
        )
      ).toEqual(
        'SELECT * \nFROM messages \nWHERE (receiver_user_id = Users.id \nAND created >= :c1))'
      );
    });

    it('Formats Python-style parameters', () => {
      expect(
        formatter.toString(
          'SELECT * FROM messages WHERE (receiver_user_id = Users.id AND created >= %s))'
        )
      ).toEqual(
        'SELECT * \nFROM messages \nWHERE (receiver_user_id = Users.id \nAND created >= %s))'
      );
    });

    it('Adds newlines for keywords', () => {
      expect(
        formatter.toString('SELECT hello FROM users ORDER BY name DESC LIMIT 1;')
      ).toEqual('SELECT hello \nFROM users \nORDER BY name DESC \nLIMIT 1;');
    });
  });
});
