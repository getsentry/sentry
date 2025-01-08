import {MutableSearch, TokenType} from 'sentry/utils/tokenizeSearch';

describe('utils/tokenizeSearch', function () {
  describe('MutableSearch.fromQueryObject', function () {
    it.each([
      [{transaction: '/index'}, 'transaction:/index'],
      [{transaction: '/index', has: 'span.domain'}, 'transaction:/index has:span.domain'],
      [{transaction: '/index', 'span.domain': undefined}, 'transaction:/index'],
      [{'span.domain': '*hello*'}, 'span.domain:*hello*'],
      [{'span.description': '*hello*'}, 'span.description:*hello*'],
      [{'span.duration': ['>0', '<100']}, 'span.duration:>0 span.duration:<100'],
      [{transaction: '(empty)'}, '!has:transaction'],
    ])('converts %s to search string', (query, result) => {
      expect(MutableSearch.fromQueryObject(query).formatString()).toEqual(result);
    });
  });

  describe('new MutableSearch()', function () {
    const cases = [
      {
        name: 'should convert a basic query string to a query object',
        string: 'is:unresolved',
        object: {
          tokens: [{type: TokenType.FILTER, key: 'is', value: 'unresolved'}],
        },
      },
      {
        name: 'should convert quoted strings',
        string: 'is:unresolved browser:"Chrome 36"',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'is', value: 'unresolved'},
            {type: TokenType.FILTER, key: 'browser', value: 'Chrome 36'},
          ],
        },
      },
      {
        name: 'should populate the text query',
        string: 'python is:unresolved browser:"Chrome 36"',
        object: {
          tokens: [
            {type: TokenType.FREE_TEXT, value: 'python'},
            {type: TokenType.FILTER, key: 'is', value: 'unresolved'},
            {type: TokenType.FILTER, key: 'browser', value: 'Chrome 36'},
          ],
        },
      },
      {
        name: 'should tokenize the text query',
        string: 'python   exception',
        object: {
          tokens: [
            {type: TokenType.FREE_TEXT, value: 'python'},
            {type: TokenType.FREE_TEXT, value: 'exception'},
          ],
        },
      },
      {
        name: 'should tokenize has condition',
        string: 'has:user has:browser',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'has', value: 'user'},
            {type: TokenType.FILTER, key: 'has', value: 'browser'},
          ],
        },
      },
      {
        name: 'should tokenize !has condition',
        string: '!has:user has:browser',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: '!has', value: 'user'},
            {type: TokenType.FILTER, key: 'has', value: 'browser'},
          ],
        },
      },
      {
        name: 'should remove spaces in the query',
        string: 'python  is:unresolved exception',
        object: {
          tokens: [
            {type: TokenType.FREE_TEXT, value: 'python'},
            {type: TokenType.FILTER, key: 'is', value: 'unresolved'},
            {type: TokenType.FREE_TEXT, value: 'exception'},
          ],
        },
      },
      {
        name: 'should tokenize the quoted tags',
        string: 'event.type:error title:"QueryExecutionError: Code: 141."',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'event.type', value: 'error'},
            {
              type: TokenType.FILTER,
              key: 'title',
              value: 'QueryExecutionError: Code: 141.',
            },
          ],
        },
      },
      {
        name: 'should tokenize words with :: in them',
        string: 'key:Resque::DirtyExit',
        object: {
          tokens: [{type: TokenType.FILTER, key: 'key', value: 'Resque::DirtyExit'}],
        },
      },
      {
        name: 'tokens that begin with a colon are still queries',
        string: 'country:canada :unresolved',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'country', value: 'canada'},
            {type: TokenType.FREE_TEXT, value: ':unresolved'},
          ],
        },
      },
      {
        name: 'correctly preserve boolean operators',
        string: 'country:canada Or country:newzealand',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'country', value: 'canada'},
            {type: TokenType.OPERATOR, value: 'OR'},
            {type: TokenType.FILTER, key: 'country', value: 'newzealand'},
          ],
        },
      },
      {
        name: 'correctly preserve parens',
        string: '(country:canada Or country:newzealand) AnD province:pei',
        object: {
          tokens: [
            {type: TokenType.OPERATOR, value: '('},
            {type: TokenType.FILTER, key: 'country', value: 'canada'},
            {type: TokenType.OPERATOR, value: 'OR'},
            {type: TokenType.FILTER, key: 'country', value: 'newzealand'},
            {type: TokenType.OPERATOR, value: ')'},
            {type: TokenType.OPERATOR, value: 'AND'},
            {type: TokenType.FILTER, key: 'province', value: 'pei'},
          ],
        },
      },
      {
        name: 'query tags boolean and parens are all stitched back together correctly',
        string: '(a:a OR (b:b AND c d e)) OR f g:g',
        object: {
          tokens: [
            {type: TokenType.OPERATOR, value: '('},
            {type: TokenType.FILTER, key: 'a', value: 'a'},
            {type: TokenType.OPERATOR, value: 'OR'},
            {type: TokenType.OPERATOR, value: '('},
            {type: TokenType.FILTER, key: 'b', value: 'b'},
            {type: TokenType.OPERATOR, value: 'AND'},
            {type: TokenType.FREE_TEXT, value: 'c'},
            {type: TokenType.FREE_TEXT, value: 'd'},
            {type: TokenType.FREE_TEXT, value: 'e'},
            {type: TokenType.OPERATOR, value: ')'},
            {type: TokenType.OPERATOR, value: ')'},
            {type: TokenType.OPERATOR, value: 'OR'},
            {type: TokenType.FREE_TEXT, value: 'f'},
            {type: TokenType.FILTER, key: 'g', value: 'g'},
          ],
        },
      },
      {
        name: 'correctly preserve filters with functions',
        string: 'country:>canada OR coronaFree():<newzealand',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'country', value: '>canada'},
            {type: TokenType.OPERATOR, value: 'OR'},
            {type: TokenType.FILTER, key: 'coronaFree()', value: '<newzealand'},
          ],
        },
      },
      {
        name: 'correctly preserves leading/trailing escaped quotes',
        string: 'a:"\\"a\\""',
        object: {
          tokens: [{type: TokenType.FILTER, key: 'a', value: '\\"a\\"'}],
        },
      },
      {
        name: 'correctly tokenizes escaped quotes',
        string: 'a:"i \\" quote" b:"b\\"bb" c:"cc"',
        object: {
          tokens: [
            {type: TokenType.FILTER, key: 'a', value: 'i \\" quote'},
            {type: TokenType.FILTER, key: 'b', value: 'b\\"bb'},
            {type: TokenType.FILTER, key: 'c', value: 'cc'},
          ],
        },
      },
    ];

    for (const {name, string, object} of cases) {
      it(`${name}`, () => expect(new MutableSearch(string)).toEqual(object));
    }
  });

  describe('QueryResults operations', function () {
    it('add tokens to query object', function () {
      const results = new MutableSearch([]);

      results.addStringFilter('a:a');
      expect(results.formatString()).toBe('a:a');

      results.addFilterValues('b', ['b']);
      expect(results.formatString()).toBe('a:a b:b');

      results.addFilterValues('c', ['c1', 'c2']);
      expect(results.formatString()).toBe('a:a b:b c:c1 c:c2');

      results.addFilterValues('d', ['d']);
      expect(results.formatString()).toBe('a:a b:b c:c1 c:c2 d:d');

      results.addFilterValues('e', ['e1*e2\\e3']);
      expect(results.formatString()).toBe('a:a b:b c:c1 c:c2 d:d e:"e1\\*e2\\e3"');

      results.addStringFilter('d:d2');
      expect(results.formatString()).toBe('a:a b:b c:c1 c:c2 d:d e:"e1\\*e2\\e3" d:d2');
    });

    it('adds individual values to query object', function () {
      const results = new MutableSearch([]);

      results.addFilterValue('e', 'e1*e2\\e3');
      expect(results.formatString()).toBe('e:"e1\\*e2\\e3"');
    });

    it('add text searches to query object', function () {
      const results = new MutableSearch(['a:a']);

      results.addFreeText('b');
      expect(results.formatString()).toBe('a:a b');
      expect(results.freeText).toEqual(['b']);

      results.addFreeText('c');
      expect(results.formatString()).toBe('a:a b c');
      expect(results.freeText).toEqual(['b', 'c']);

      results.addStringFilter('d:d').addFreeText('e');
      expect(results.formatString()).toBe('a:a b c d:d e');
      expect(results.freeText).toEqual(['b', 'c', 'e']);

      results.freeText = ['x', 'y'];
      expect(results.formatString()).toBe('a:a d:d x y');
      expect(results.freeText).toEqual(['x', 'y']);

      results.freeText = ['a b c'];
      expect(results.formatString()).toBe('a:a d:d "a b c"');
      expect(results.freeText).toEqual(['a b c']);

      results.freeText = ['invalid literal for int() with base'];
      expect(results.formatString()).toBe(
        'a:a d:d "invalid literal for int() with base"'
      );
      expect(results.freeText).toEqual(['invalid literal for int() with base']);
    });

    it('add ops to query object', function () {
      const results = new MutableSearch(['x', 'a:a', 'y']);

      results.addOp('OR');
      expect(results.formatString()).toBe('x a:a y OR');

      results.addFreeText('z');
      expect(results.formatString()).toBe('x a:a y OR z');

      results
        .addOp('(')
        .addStringFilter('b:b')
        .addOp('AND')
        .addStringFilter('c:c')
        .addOp(')');
      expect(results.formatString()).toBe('x a:a y OR z ( b:b AND c:c )');
    });

    it('adds tags to query', function () {
      const results = new MutableSearch(['tag:value']);

      results.addStringFilter('new:too');
      expect(results.formatString()).toBe('tag:value new:too');
    });

    it('setTag() replaces tags', function () {
      const results = new MutableSearch(['tag:value']);

      results.setFilterValues('tag', ['too']);
      expect(results.formatString()).toBe('tag:too');
    });

    it('setTag() replaces tags in OR', function () {
      let results = new MutableSearch([
        '(',
        'transaction:xyz',
        'OR',
        'transaction:abc',
        ')',
      ]);

      results.setFilterValues('transaction', ['def']);
      expect(results.formatString()).toBe('transaction:def');

      results = new MutableSearch(['(transaction:xyz', 'OR', 'transaction:abc)']);
      results.setFilterValues('transaction', ['def']);
      expect(results.formatString()).toBe('transaction:def');
    });

    it('does not remove boolean operators after setting tag values', function () {
      const results = new MutableSearch([
        '(',
        'start:xyz',
        'AND',
        'end:abc',
        ')',
        'OR',
        '(',
        'start:abc',
        'AND',
        'end:xyz',
        ')',
      ]);

      results.setFilterValues('transaction', ['def']);
      expect(results.formatString()).toBe(
        '( start:xyz AND end:abc ) OR ( start:abc AND end:xyz ) transaction:def'
      );
    });

    it('removes tags from query object', function () {
      let results = new MutableSearch(['x', 'a:a', 'b:b']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('x b:b');

      results = new MutableSearch(['a:a']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('');

      results = new MutableSearch(['x', 'a:a', 'a:a2']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('x');

      results = new MutableSearch(['a:a', 'OR', 'b:b']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('b:b');

      results = new MutableSearch(['a:a', 'OR', 'a:a1', 'AND', 'b:b']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('b:b');

      results = new MutableSearch(['(a:a', 'OR', 'b:b)']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('b:b');

      results = new MutableSearch(['(a:a', 'OR', 'b:b', 'OR', 'y)']);
      results.removeFilter('a');
      expect(results.formatString()).toBe('( b:b OR y )');

      results = new MutableSearch(['(a:a', 'OR', '(b:b1', 'OR', '(c:c', 'OR', 'b:b2)))']);
      results.removeFilter('b');
      expect(results.formatString()).toBe('( a:a OR c:c )');

      results = new MutableSearch(['(((a:a', 'OR', 'b:b1)', 'OR', 'c:c)', 'OR', 'b:b2)']);
      results.removeFilter('b');
      expect(results.formatString()).toBe('( ( a:a OR c:c ) )');

      results = new MutableSearch(['a:a', '(b:b1', 'OR', 'b:b2', 'OR', 'b:b3)', 'c:c']);
      results.removeFilter('b');
      expect(results.formatString()).toBe('a:a c:c');
    });

    it('can return the tag keys', function () {
      const results = new MutableSearch(['tag:value', 'other:value', 'additional text']);

      expect(results.getFilterKeys()).toEqual(['tag', 'other']);
    });

    it('getTagValues', () => {
      const results = new MutableSearch([
        'tag:value',
        'other:value',
        'tag:value2',
        'additional text',
      ]);
      expect(results.getFilterValues('tag')).toEqual(['value', 'value2']);

      expect(results.getFilterValues('nonexistent')).toEqual([]);
    });
  });

  describe('QueryResults.formatString', function () {
    const cases = [
      {
        name: 'should convert a basic object to a query string',
        object: new MutableSearch(['is:unresolved']),
        string: 'is:unresolved',
      },
      {
        name: 'should quote tags with spaces',
        object: new MutableSearch(['is:unresolved', 'browser:"Chrome 36"']),
        string: 'is:unresolved browser:"Chrome 36"',
      },
      {
        name: 'should stringify the query',
        object: new MutableSearch(['python', 'is:unresolved', 'browser:"Chrome 36"']),
        string: 'python is:unresolved browser:"Chrome 36"',
      },
      {
        name: 'should join tokenized queries',
        object: new MutableSearch(['python', 'exception']),
        string: 'python exception',
      },
      {
        name: 'should quote tags with spaces',
        object: new MutableSearch([
          'oh',
          'me',
          'oh',
          'my',
          'browser:"Chrome 36"',
          'browser:"Firefox 60"',
        ]),
        string: 'oh me oh my browser:"Chrome 36" browser:"Firefox 60"',
      },
      {
        name: 'should quote tags with parens',
        object: new MutableSearch([
          'bad',
          'things',
          'repository_id:"UUID(\'long-value\')"',
        ]),
        string: 'bad things repository_id:"UUID(\'long-value\')"',
      },
      {
        // values with quotes do not need to be quoted
        // furthermore, timestamps contain colons
        // but the backend currently does not support quoted date formats
        name: 'should not quote tags with colon',
        object: new MutableSearch(['bad', 'things', 'user:"id:123"']),
        string: 'bad things user:id:123',
      },
      {
        name: 'should escape quote tags with double quotes',
        object: new MutableSearch([
          'bad',
          'things',
          'name:"Ernest \\"Papa\\" Hemingway"',
        ]),
        string: 'bad things name:"Ernest \\"Papa\\" Hemingway"',
      },
      {
        name: 'should include blank strings',
        object: new MutableSearch(['bad', 'things', 'name:""']),
        string: 'bad things name:""',
      },
      {
        name: 'correctly preserve boolean operators',
        object: new MutableSearch(['country:canada', 'OR', 'country:newzealand']),
        string: 'country:canada OR country:newzealand',
      },
      {
        name: 'correctly preserve parens',
        object: new MutableSearch([
          '(country:canada',
          'OR',
          'country:newzealand)',
          'AND',
          'province:pei',
        ]),
        string: '( country:canada OR country:newzealand ) AND province:pei',
      },
      {
        name: 'query tags boolean and parens are all stitched back together correctly',
        object: new MutableSearch([
          '(a:a',
          'OR',
          '(b:b',
          'AND',
          'c',
          'd',
          'e))',
          'OR',
          'f',
          'g:g',
        ]),
        string: '( a:a OR ( b:b AND c d e ) ) OR f g:g',
      },
      {
        name: 'correctly preserve filters with functions',
        object: new MutableSearch(['country:>canada', 'OR', 'coronaFree():<newzealand']),
        string: 'country:>canada OR coronaFree():<newzealand',
      },
      {
        name: 'should quote tags with parens and spaces',
        object: new MutableSearch(['release:4.9.0 build (0.0.01)', 'error.handled:0']),
        string: 'release:"4.9.0 build (0.0.01)" error.handled:0',
      },
    ];

    for (const {name, string, object} of cases) {
      it(`${name}`, () => expect(object.formatString()).toEqual(string));
    }
  });
});
