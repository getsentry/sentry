import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';

describe('MutableSearch', () => {
  describe('MutableSearch.fromQueryObject', () => {
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
    ])('normalizes %s -> %s', (input, expected) => {
      expect(new MutableSearch(input).formatString()).toEqual(expected);
    });
  });

  describe('operations', () => {
    it('add tokens to query object', () => {
      const results = new MutableSearch('');

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
    });

    it('can return the tag keys', () => {
      const results = new MutableSearch('tag:value other:value additional text');
      expect(results.getFilterKeys()).toEqual(['tag', 'other']);
    });

    it('getFilterValues', () => {
      const results = new MutableSearch(
        'tag:value other:value tag:value2 additional text'
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
    });
  });

  describe('formatString edge cases', () => {
    it.each([
      [new MutableSearch('is:unresolved'), 'is:unresolved'],
      [
        new MutableSearch('is:unresolved browser:"Chrome 36"'),
        'is:unresolved browser:"Chrome 36"',
      ],
      [new MutableSearch('python exception'), 'python exception'],
      [
        new MutableSearch('oh me oh my browser:"Chrome 36" browser:"Firefox 60"'),
        'oh me oh my browser:"Chrome 36" browser:"Firefox 60"',
      ],
      [
        new MutableSearch('bad things repository_id:"UUID(\'long-value\')"'),
        'bad things repository_id:"UUID(\'long-value\')"',
      ],
      [new MutableSearch('bad things user:"id:123"'), 'bad things user:id:123'],
      [
        new MutableSearch('bad things name:"Ernest \\"Papa\\" Hemingway"'),
        'bad things name:"Ernest \\"Papa\\" Hemingway"',
      ],
      [new MutableSearch('bad things name:""'), 'bad things name:""'],
      [
        new MutableSearch('country:canada OR country:newzealand'),
        'country:canada OR country:newzealand',
      ],
      [
        new MutableSearch('(country:canada OR country:newzealand) AND province:pei'),
        '( country:canada OR country:newzealand ) AND province:pei',
      ],
      [
        new MutableSearch('(a:a OR (b:b AND c d e)) OR f g:g'),
        '( a:a OR ( b:b AND c d e ) ) OR f g:g',
      ],
      [
        new MutableSearch('country:>canada OR coronaFree():<newzealand'),
        'country:>canada OR coronaFree():<newzealand',
      ],
      [
        new MutableSearch('release:4.9.0 build (0.0.01) error.handled:0'),
        'release:"4.9.0 build (0.0.01)" error.handled:0',
      ],
      [new MutableSearch('transaction:[alpha,beta]'), 'transaction:[alpha,beta]'],
      [new MutableSearch('transaction:["alpha","beta"]'), 'transaction:["alpha","beta"]'],
      [new MutableSearch('transaction:["alpha",beta]'), 'transaction:["alpha",beta]'],
      [
        new MutableSearch('transaction:["this has a space",thisdoesnot]'),
        'transaction:["this has a space",thisdoesnot]',
      ],
      [new MutableSearch('message:"[filtered]"'), 'message:"[filtered]"'],
      [new MutableSearch('message:"[Filtered]"'), 'message:"[Filtered]"'],
      [new MutableSearch('message:[Test]'), 'message:[Test]'],
      [new MutableSearch('message:[test]'), 'message:[test]'],
      [new MutableSearch('message:[test,[test2]]'), 'message:[test,[test2]]'],
      [
        new MutableSearch('message:["[test]",test,[test2]]'),
        'message:["[test]",test,[test2]]',
      ],
      [
        new MutableSearch('message:[test,"[nested]",other]'),
        'message:[test,"[nested]",other]',
      ],
      [
        new MutableSearch('message:["value with \\" escaped quote",other]'),
        'message:["value with \\" escaped quote",other]',
      ],
      [
        new MutableSearch('message:["value with \\\\\\" complex escape",other]'),
        'message:["value with \\\\\\" complex escape",other]',
      ],
      // [
      //   new MutableSearch('message:"[test, "[Filtered]"]"'),
      //   'message:"[test, "[Filtered]"]"',
      // ],
    ])('produces %s', (obj, expected) => {
      expect(obj.formatString()).toEqual(expected);
    });
  });
});
