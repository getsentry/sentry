import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {WildcardOperators} from 'sentry/components/searchSyntax/parser';

describe('MutableSearch', () => {
  describe('fromQueryObject', () => {
    it.each([
      [{transaction: '/index'}, 'transaction:/index'],
      [{transaction: '/index', has: 'span.domain'}, 'transaction:/index has:span.domain'],
      [{transaction: '/index', 'span.domain': undefined}, 'transaction:/index'],
      [{'span.domain': '*hello*'}, 'span.domain:*hello*'],
      [{'span.description': '*hello*'}, 'span.description:*hello*'],
      [{'span.duration': ['>0', '<100']}, 'span.duration:>0 span.duration:<100'],
      [{transaction: '(empty)'}, '!has:transaction'],
      [{'span.op': '\uf00dContains\uf00dtest'}, 'span.op:\uf00dContains\uf00dtest'],
      [{'span.op': '\uf00dStartsWith\uf00dtest'}, 'span.op:\uf00dStartsWith\uf00dtest'],
      [{'span.op': '\uf00dEndsWith\uf00dtest'}, 'span.op:\uf00dEndsWith\uf00dtest'],
    ])('converts %s to search string', (query, result) => {
      expect(MutableSearch.fromQueryObject(query).formatString()).toEqual(result);
    });
  });

  describe('parsing and normalization', () => {
    it.each([
      ['is:unresolved', 'is:unresolved'],
      ['is:unresolved browser:"Chrome 36"', 'is:unresolved browser:"Chrome 36"'],
      [
        'python is:unresolved browser:"Chrome 36"',
        'python is:unresolved browser:"Chrome 36"',
      ],
      ['python   exception', 'python exception'],
      ['has:user has:browser', 'has:user has:browser'],
      ['!has:user has:browser', '!has:user has:browser'],
      [
        'event.type:error title:"QueryExecutionError: Code: 141."',
        'event.type:error title:"QueryExecutionError: Code: 141."',
      ],
      ['key:Resque::DirtyExit', 'key:Resque::DirtyExit'],
      ['country:canada :unresolved', 'country:canada :unresolved'],
      ['country:canada Or country:newzealand', 'country:canada OR country:newzealand'],
      [
        '(country:canada Or country:newzealand) AnD province:pei',
        '( country:canada OR country:newzealand ) AND province:pei',
      ],
      ['(a:a OR (b:b AND c d e)) OR f g:g', '( a:a OR ( b:b AND c d e ) ) OR f g:g'],
      [
        'country:>canada OR coronaFree():<newzealand',
        'country:>canada OR coronaFree():<newzealand',
      ],
      ['a:"\\"a\\""', 'a:"\\"a\\""'],
      ['a:"i \\" quote" b:"b\\"bb" c:"cc"', 'a:"i \\" quote" b:"b\\"bb" c:"cc"'],
      ['tags["foo:bar",string]:asdf', 'tags["foo:bar",string]:asdf'],
      ['span.op:\uf00dContains\uf00dtest', 'span.op:\uf00dContains\uf00dtest'],
      ['span.op:\uf00dStartsWith\uf00dtest', 'span.op:\uf00dStartsWith\uf00dtest'],
      ['span.op:\uf00dEndsWith\uf00dtest', 'span.op:\uf00dEndsWith\uf00dtest'],
    ])('normalizes %s -> %s', (input, expected) => {
      expect(new MutableSearch(input).formatString()).toEqual(expected);
    });
  });

  describe('operations', () => {
    it('add tokens to query object', () => {
      let results = new MutableSearch('');

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

      results.addStringFilter('f:\uf00dContains\uf00dtest');
      expect(results.formatString()).toBe(
        'a:a b:b c:c1 c:c2 d:d e:"e1\\*e2\\e3" d:d2 f:\uf00dContains\uf00dtest'
      );

      results.addStringFilter('g:\uf00dStartsWith\uf00dtest1');
      expect(results.formatString()).toBe(
        'a:a b:b c:c1 c:c2 d:d e:"e1\\*e2\\e3" d:d2 f:\uf00dContains\uf00dtest g:\uf00dStartsWith\uf00dtest1'
      );

      results.addStringFilter('h:\uf00dEndsWith\uf00dtest2');
      expect(results.formatString()).toBe(
        'a:a b:b c:c1 c:c2 d:d e:"e1\\*e2\\e3" d:d2 f:\uf00dContains\uf00dtest g:\uf00dStartsWith\uf00dtest1 h:\uf00dEndsWith\uf00dtest2'
      );

      results = new MutableSearch('');
      results.addContainsFilterValue('f', 'test');
      expect(results.formatString()).toBe('f:\uf00dContains\uf00dtest');

      results.addContainsFilterValues('g', ['test1', 'test2']);
      expect(results.formatString()).toBe(
        'f:\uf00dContains\uf00dtest g:\uf00dContains\uf00dtest1 g:\uf00dContains\uf00dtest2'
      );

      results.addStartsWithFilterValue('h', 'test');
      expect(results.formatString()).toBe(
        'f:\uf00dContains\uf00dtest g:\uf00dContains\uf00dtest1 g:\uf00dContains\uf00dtest2 h:\uf00dStartsWith\uf00dtest'
      );

      results.addStartsWithFilterValues('i', ['test1', 'test2']);
      expect(results.formatString()).toBe(
        'f:\uf00dContains\uf00dtest g:\uf00dContains\uf00dtest1 g:\uf00dContains\uf00dtest2 h:\uf00dStartsWith\uf00dtest i:\uf00dStartsWith\uf00dtest1 i:\uf00dStartsWith\uf00dtest2'
      );

      results.addEndsWithFilterValue('j', 'test');
      expect(results.formatString()).toBe(
        'f:\uf00dContains\uf00dtest g:\uf00dContains\uf00dtest1 g:\uf00dContains\uf00dtest2 h:\uf00dStartsWith\uf00dtest i:\uf00dStartsWith\uf00dtest1 i:\uf00dStartsWith\uf00dtest2 j:\uf00dEndsWith\uf00dtest'
      );

      results.addEndsWithFilterValues('k', ['test1', 'test2']);
      expect(results.formatString()).toBe(
        'f:\uf00dContains\uf00dtest g:\uf00dContains\uf00dtest1 g:\uf00dContains\uf00dtest2 h:\uf00dStartsWith\uf00dtest i:\uf00dStartsWith\uf00dtest1 i:\uf00dStartsWith\uf00dtest2 j:\uf00dEndsWith\uf00dtest k:\uf00dEndsWith\uf00dtest1 k:\uf00dEndsWith\uf00dtest2'
      );
    });

    it('adds individual values to query object', () => {
      const results = new MutableSearch('');

      results.addFilterValue('e', 'e1*e2\\e3');
      expect(results.formatString()).toBe('e:"e1\\*e2\\e3"');
    });

    it('add text searches to query object', () => {
      const results = new MutableSearch('a:a');

      results.addFreeText('b');
      expect(results.formatString()).toBe('a:a b');
      expect(results.getFreeText()).toEqual(['b']);

      results.addFreeText('c');
      expect(results.formatString()).toBe('a:a b c');
      expect(results.getFreeText()).toEqual(['b', 'c']);

      results.addStringFilter('d:d').addFreeText('e');
      expect(results.formatString()).toBe('a:a b c d:d e');
      expect(results.getFreeText()).toEqual(['b', 'c', 'e']);

      results.setFreeText(['x', 'y']);
      expect(results.formatString()).toBe('a:a d:d x y');
      expect(results.getFreeText()).toEqual(['x', 'y']);

      results.setFreeText(['a b c']);
      expect(results.formatString()).toBe('a:a d:d "a b c"');
      expect(results.getFreeText()).toEqual(['a b c']);

      results.setFreeText(['invalid literal for int() with base']);
      expect(results.formatString()).toBe(
        'a:a d:d "invalid literal for int() with base"'
      );
      expect(results.getFreeText()).toEqual(['invalid literal for int() with base']);
    });

    it('add ops to query object', () => {
      const results = new MutableSearch('x a:a y');

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

    it('adds tags to query', () => {
      const results = new MutableSearch('tag:value');

      results.addStringFilter('new:too');
      expect(results.formatString()).toBe('tag:value new:too');
    });

    it('setFilterValues replaces tags', () => {
      const results = new MutableSearch('tag:value');

      results.setFilterValues('tag', ['too']);
      expect(results.formatString()).toBe('tag:too');

      results.setContainsFilterValues('tag', ['baz']);
      expect(results.formatString()).toBe(`tag:${WildcardOperators.CONTAINS}baz`);

      results.setStartsWithFilterValues('tag', ['foo']);
      expect(results.formatString()).toBe(`tag:${WildcardOperators.STARTS_WITH}foo`);

      results.setEndsWithFilterValues('tag', ['bar']);
      expect(results.formatString()).toBe(`tag:${WildcardOperators.ENDS_WITH}bar`);
    });

    it('setFilterValues replaces tags in OR', () => {
      let results = new MutableSearch('( transaction:xyz OR transaction:abc )');

      results.setFilterValues('transaction', ['def']);
      expect(results.formatString()).toBe('transaction:def');

      results = new MutableSearch('(transaction:xyz OR transaction:abc)');
      results.setFilterValues('transaction', ['def']);
      expect(results.formatString()).toBe('transaction:def');
    });

    it('does not remove boolean operators after setting tag values', () => {
      const results = new MutableSearch(
        '( start:xyz AND end:abc ) OR ( start:abc AND end:xyz )'
      );

      results.setFilterValues('transaction', ['def']);
      expect(results.formatString()).toBe(
        '( start:xyz AND end:abc ) OR ( start:abc AND end:xyz ) transaction:def'
      );
    });

    it('removes tags from query object', () => {
      let results = new MutableSearch('x a:a b:b');
      results.removeFilter('a');
      expect(results.formatString()).toBe('x b:b');

      results = new MutableSearch('a:a');
      results.removeFilter('a');
      expect(results.formatString()).toBe('');

      results = new MutableSearch('x a:a a:a2');
      results.removeFilter('a');
      expect(results.formatString()).toBe('x');

      results = new MutableSearch('a:a OR b:b');
      results.removeFilter('a');
      expect(results.formatString()).toBe('b:b');

      results = new MutableSearch('a:a OR a:a1 AND b:b');
      results.removeFilter('a');
      expect(results.formatString()).toBe('b:b');

      results = new MutableSearch('(a:a OR b:b)');
      results.removeFilter('a');
      expect(results.formatString()).toBe('b:b');

      results = new MutableSearch('(a:a OR b:b OR y)');
      results.removeFilter('a');
      expect(results.formatString()).toBe('( b:b OR y )');

      results = new MutableSearch('(a:a OR (b:b1 OR (c:c OR b:b2)))');
      results.removeFilter('b');
      expect(results.formatString()).toBe('( a:a OR c:c )');

      results = new MutableSearch('(((a:a OR b:b1) OR c:c) OR b:b2)');
      results.removeFilter('b');
      expect(results.formatString()).toBe('( ( a:a OR c:c ) )');

      results = new MutableSearch('a:a (b:b1 OR b:b2 OR b:b3) c:c');
      results.removeFilter('b');
      expect(results.formatString()).toBe('a:a c:c');

      results = new MutableSearch(
        `a:a b:${WildcardOperators.CONTAINS}foo b:${WildcardOperators.STARTS_WITH}bar b:${WildcardOperators.ENDS_WITH}baz`
      );
      results.removeFilter('b');
      expect(results.formatString()).toBe('a:a');
    });

    it('can return the tag keys', () => {
      let results = new MutableSearch('tag:value other:value additional text');
      expect(results.getFilterKeys()).toEqual(['tag', 'other']);

      results = new MutableSearch(
        `tag:${WildcardOperators.CONTAINS}value other:value additional text`
      );
      expect(results.getFilterKeys()).toEqual(['tag', 'other']);
    });

    it('getFilterValues', () => {
      let results = new MutableSearch('tag:value other:value tag:value2 additional text');
      expect(results.getFilterValues('tag')).toEqual(['value', 'value2']);
      expect(results.getFilterValues('nonexistent')).toEqual([]);

      results = new MutableSearch(
        `tag:${WildcardOperators.CONTAINS}value other:${WildcardOperators.STARTS_WITH}value tag:${WildcardOperators.ENDS_WITH}value2 additional text`
      );
      expect(results.getFilterValues('tag')).toEqual(['value', 'value2']);
      expect(results.getFilterValues('nonexistent')).toEqual([]);
    });

    it('getFilterValues splits bracket list into items', () => {
      const results = new MutableSearch('event.type:[error, default]');
      expect(results.getFilterValues('event.type')).toEqual(['error', 'default']);
    });

    it('removeFilter handles bracket list', () => {
      let results = new MutableSearch('event.type:[error, default]');
      results.removeFilter('event.type');
      expect(results.formatString()).toBe('');

      results = new MutableSearch('event.type:[error, default] browser:Chrome');
      results.removeFilter('event.type');
      expect(results.formatString()).toBe('browser:Chrome');

      results = new MutableSearch(
        `event.type:${WildcardOperators.CONTAINS}error event.type:${WildcardOperators.ENDS_WITH}default browser:Chrome`
      );
      results.removeFilter('event.type');
      expect(results.formatString()).toBe('browser:Chrome');
    });

    it('addDisjunctionFilterValues', () => {
      const results = new MutableSearch('');

      results.addDisjunctionFilterValues('a', ['a1', 'a2']);
      expect(results.formatString()).toBe('( a:a1 OR a:a2 )');

      results.addDisjunctionContainsFilterValues('b', ['b1', 'b2']);
      expect(results.formatString()).toBe(
        `( a:a1 OR a:a2 ) ( b:${WildcardOperators.CONTAINS}b1 OR b:${WildcardOperators.CONTAINS}b2 )`
      );

      results.addDisjunctionStartsWithFilterValues('c', ['c1', 'c2']);
      expect(results.formatString()).toBe(
        `( a:a1 OR a:a2 ) ( b:${WildcardOperators.CONTAINS}b1 OR b:${WildcardOperators.CONTAINS}b2 ) ( c:${WildcardOperators.STARTS_WITH}c1 OR c:${WildcardOperators.STARTS_WITH}c2 )`
      );

      results.addDisjunctionEndsWithFilterValues('d', ['d1', 'd2']);
      expect(results.formatString()).toBe(
        `( a:a1 OR a:a2 ) ( b:${WildcardOperators.CONTAINS}b1 OR b:${WildcardOperators.CONTAINS}b2 ) ( c:${WildcardOperators.STARTS_WITH}c1 OR c:${WildcardOperators.STARTS_WITH}c2 ) ( d:${WildcardOperators.ENDS_WITH}d1 OR d:${WildcardOperators.ENDS_WITH}d2 )`
      );
    });

    it('addFilterValueList', () => {
      const results = new MutableSearch('');

      results.addFilterValueList('a', ['a1', 'a2']);
      expect(results.formatString()).toBe('a:[a1,a2]');

      results.addContainsFilterValueList('b', ['b1', 'b2']);
      expect(results.formatString()).toBe(
        `a:[a1,a2] b:${WildcardOperators.CONTAINS}[b1,b2]`
      );

      results.addStartsWithFilterValueList('c', ['c1', 'c2']);
      expect(results.formatString()).toBe(
        `a:[a1,a2] b:${WildcardOperators.CONTAINS}[b1,b2] c:${WildcardOperators.STARTS_WITH}[c1,c2]`
      );

      results.addEndsWithFilterValueList('d', ['d1', 'd2']);
      expect(results.formatString()).toBe(
        `a:[a1,a2] b:${WildcardOperators.CONTAINS}[b1,b2] c:${WildcardOperators.STARTS_WITH}[c1,c2] d:${WildcardOperators.ENDS_WITH}[d1,d2]`
      );
    });
  });

  describe('formatString', () => {
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
      {
        name: 'should not enclose the entire query in quotes if there are no spaces in brackets shorthand',
        object: new MutableSearch(['transaction:[alpha,beta]']),
        string: 'transaction:[alpha,beta]',
      },
      {
        name: 'should not enclose the entire query in quotes if there are quotes around args',
        object: new MutableSearch(['transaction:["alpha","beta"]']),
        string: 'transaction:["alpha","beta"]',
      },
      {
        name: 'should not enclose the entire query in quotes if some args are quoted in brackets',
        object: new MutableSearch(['transaction:["alpha",beta]']),
        string: 'transaction:["alpha",beta]',
      },
      {
        name: 'should not enclose the entire query in quotes if there are spaces in quoted args',
        object: new MutableSearch(['transaction:["this has a space",thisdoesnot]']),
        string: 'transaction:["this has a space",thisdoesnot]',
      },
      {
        name: 'should preserve quotes around bracket expressions when parsing and formatting',
        object: new MutableSearch(['message:"[filtered]"']),
        string: 'message:"[filtered]"',
      },
      {
        name: 'should preserve quotes around bracket expressions when parsing and formatting',
        object: new MutableSearch(['message:"[Filtered]"']),
        string: 'message:"[Filtered]"',
      },
      {
        name: 'should not add quotes to unquoted bracket expressions',
        object: new MutableSearch(['message:[Test]']),
        string: 'message:[Test]',
      },
      {
        name: 'should not add quotes to unquoted bracket expressions',
        object: new MutableSearch(['message:[test]']),
        string: 'message:[test]',
      },
      {
        name: 'should not add quotes to unquoted bracket expressions',
        object: new MutableSearch(['message:[test,[test2]]']),
        string: 'message:[test,[test2]]',
      },
      {
        name: 'should preserve brackets within quoted strings when flattening',
        object: new MutableSearch(['message:["[test]",test,[test2]]']),
        string: 'message:["[test]",test,[test2]]',
      },
      {
        name: 'should correctly handle nested brackets with quoted brackets inside',
        object: new MutableSearch(['message:[test,"[nested]",other]']),
        string: 'message:[test,"[nested]",other]',
      },
      {
        name: 'should handle escaped quotes in array syntax correctly',
        object: new MutableSearch(['message:["value with \\" escaped quote",other]']),
        string: 'message:["value with \\" escaped quote",other]',
      },
      {
        name: 'should handle complex escape sequences in array syntax correctly',
        object: new MutableSearch([
          'message:["value with \\\\\\" complex escape",other]',
        ]),
        string: 'message:["value with \\\\\\" complex escape",other]',
      },
      {
        name: 'handles contains filter',
        object: new MutableSearch(['message:\uf00dContains\uf00d"test value"']),
        string: 'message:\uf00dContains\uf00d"test value"',
      },
      {
        name: 'handles starts with filter',
        object: new MutableSearch(['message:\uf00dStartsWith\uf00d"test value"']),
        string: 'message:\uf00dStartsWith\uf00d"test value"',
      },
      {
        name: 'handles ends with filter',
        object: new MutableSearch(['message:\uf00dEndsWith\uf00d"test value"']),
        string: 'message:\uf00dEndsWith\uf00d"test value"',
      },
    ];

    for (const {name, string, object} of cases) {
      it(`${name}`, () => expect(object.formatString()).toEqual(string));
    }
  });
});
