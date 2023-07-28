import {SQLishParser} from 'sentry/views/starfish/utils/sqlish/SQLishParser';

describe('SQLishParser', function () {
  describe('SQLishParser()', () => {
    const parser = new SQLishParser();

    it.each([
      'SELECT;',
      'SELECT hello;',
      'SELECT *;', // Wildcards
      'WHERE age = 10;', // Equality
      'WHERE age != 10;', // Inequality
      'WHERE age > 10 AND age < 20;', // Comparison
      "WHERE$1 ILIKE ' % ' || 'text'", // Conditionals
      'SELECT id, name;', // Column lists
      'columns AS `tags[column]`', // ClickHouse backtics
      'SELECT id, nam*', // Truncation
      'AND created >= :c1', // PHP-Style I
      'LIMIT $2', // PHP-style II
      'created >= %s', // Python-style
      'created >= $1', // Rails-style
    ])('Parses %s', sql => {
      expect(() => {
        parser.parse(sql);
      }).not.toThrow();
    });
  });
});
