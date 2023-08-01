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

  describe('SQLishParser.parse', () => {
    const parser = new SQLishParser();
    it('Detects collapsed columns', () => {
      expect(parser.parse('select ..')).toEqual([
        {
          type: 'Keyword',
          content: 'select',
        },
        {
          type: 'Whitespace',
          content: ' ',
        },
        {
          type: 'CollapsedColumns',
          content: '..',
        },
      ]);
    });

    it('Detects whitespace between generic tokens and JOIN commands', () => {
      expect(parser.parse('table1 INNER JOIN table2')).toEqual([
        {
          type: 'GenericToken',
          content: 'table1',
        },
        {type: 'Whitespace', content: ' '},
        {type: 'Keyword', content: 'INNER JOIN'},
        {type: 'Whitespace', content: ' '},
        {
          type: 'GenericToken',
          content: 'table2',
        },
      ]);
    });
  });
});
