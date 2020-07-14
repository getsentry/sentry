import {
  tokenizeSearch,
  stringifyQueryObject,
  QueryResults,
  TokenType,
} from 'app/utils/tokenizeSearch';

describe('utils/tokenizeSearch', function() {
  describe('tokenizeSearch()', function() {
    const cases = [
      {
        name: 'should convert a basic query string to a query object',
        string: 'is:unresolved',
        object: {
          tokens: [{type: TokenType.TAG, key: 'is', value: 'unresolved'}],
          tagValues: {is: ['unresolved']},
        },
      },
      {
        name: 'should convert quoted strings',
        string: 'is:unresolved browser:"Chrome 36"',
        object: {
          tokens: [
            {type: TokenType.TAG, key: 'is', value: 'unresolved'},
            {type: TokenType.TAG, key: 'browser', value: 'Chrome 36'},
          ],
          tagValues: {is: ['unresolved'], browser: ['Chrome 36']},
        },
      },
      {
        name: 'should populate the text query',
        string: 'python is:unresolved browser:"Chrome 36"',
        object: {
          tokens: [
            {type: TokenType.QUERY, value: 'python'},
            {type: TokenType.TAG, key: 'is', value: 'unresolved'},
            {type: TokenType.TAG, key: 'browser', value: 'Chrome 36'},
          ],
          tagValues: {is: ['unresolved'], browser: ['Chrome 36']},
        },
      },
      {
        name: 'should tokenize the text query',
        string: 'python   exception',
        object: {
          tokens: [
            {type: TokenType.QUERY, value: 'python'},
            {type: TokenType.QUERY, value: 'exception'},
          ],
          tagValues: {},
        },
      },
      {
        name: 'should tokenize has condition',
        string: 'has:user has:browser',
        object: {
          tokens: [
            {type: TokenType.TAG, key: 'has', value: 'user'},
            {type: TokenType.TAG, key: 'has', value: 'browser'},
          ],
          tagValues: {has: ['user', 'browser']},
        },
      },
      {
        name: 'should tokenize !has condition',
        string: '!has:user has:browser',
        object: {
          tokens: [
            {type: TokenType.TAG, key: '!has', value: 'user'},
            {type: TokenType.TAG, key: 'has', value: 'browser'},
          ],
          tagValues: {'!has': ['user'], has: ['browser']},
        },
      },
      {
        name: 'should remove spaces in the query',
        string: 'python  is:unresolved exception',
        object: {
          tokens: [
            {type: TokenType.QUERY, value: 'python'},
            {type: TokenType.TAG, key: 'is', value: 'unresolved'},
            {type: TokenType.QUERY, value: 'exception'},
          ],
          tagValues: {is: ['unresolved']},
        },
      },
      {
        name: 'should tokenize the quoted tags',
        string: 'event.type:error title:"QueryExecutionError: Code: 141."',
        object: {
          tokens: [
            {type: TokenType.TAG, key: 'event.type', value: 'error'},
            {type: TokenType.TAG, key: 'title', value: 'QueryExecutionError: Code: 141.'},
          ],
          tagValues: {
            'event.type': ['error'],
            title: ['QueryExecutionError: Code: 141.'],
          },
        },
      },
      {
        name: 'should tokenize words with :: in them',
        string: 'key:Resque::DirtyExit',
        object: {
          tokens: [{type: TokenType.TAG, key: 'key', value: 'Resque::DirtyExit'}],
          tagValues: {key: ['Resque::DirtyExit']},
        },
      },
      {
        name: 'tokens that begin with a colon are still queries',
        string: 'country:canada :unresolved',
        object: {
          tokens: [
            {type: TokenType.TAG, key: 'country', value: 'canada'},
            {type: TokenType.QUERY, value: ':unresolved'},
          ],
          tagValues: {country: ['canada']},
        },
      },
      {
        name: 'correctly preserve boolean operators',
        string: 'country:canada Or country:newzealand',
        object: {
          tokens: [
            {type: TokenType.TAG, key: 'country', value: 'canada'},
            {type: TokenType.OP, value: 'OR'},
            {type: TokenType.TAG, key: 'country', value: 'newzealand'},
          ],
          tagValues: {country: ['canada', 'newzealand']},
        },
      },
      {
        name: 'correctly preserve parens',
        string: '(country:canada Or country:newzealand) AnD province:pei',
        object: {
          tokens: [
            {type: TokenType.OP, value: '('},
            {type: TokenType.TAG, key: 'country', value: 'canada'},
            {type: TokenType.OP, value: 'OR'},
            {type: TokenType.TAG, key: 'country', value: 'newzealand'},
            {type: TokenType.OP, value: ')'},
            {type: TokenType.OP, value: 'AND'},
            {type: TokenType.TAG, key: 'province', value: 'pei'},
          ],
          tagValues: {country: ['canada', 'newzealand'], province: ['pei']},
        },
      },
      {
        name: 'query tags boolean and parens are all stitched back together correctly',
        string: '(a:a OR (b:b AND c d e)) OR f g:g',
        object: {
          tokens: [
            {type: TokenType.OP, value: '('},
            {type: TokenType.TAG, key: 'a', value: 'a'},
            {type: TokenType.OP, value: 'OR'},
            {type: TokenType.OP, value: '('},
            {type: TokenType.TAG, key: 'b', value: 'b'},
            {type: TokenType.OP, value: 'AND'},
            {type: TokenType.QUERY, value: 'c'},
            {type: TokenType.QUERY, value: 'd'},
            {type: TokenType.QUERY, value: 'e'},
            {type: TokenType.OP, value: '))'},
            {type: TokenType.OP, value: 'OR'},
            {type: TokenType.QUERY, value: 'f'},
            {type: TokenType.TAG, key: 'g', value: 'g'},
          ],
          tagValues: {a: ['a'], b: ['b'], g: ['g']},
        },
      },
      {
        name: 'correctly preserve filters with functions',
        string: 'country:>canada OR coronaFree():<newzealand',
        object: {
          tokens: [
            {type: TokenType.TAG, key: 'country', value: '>canada'},
            {type: TokenType.OP, value: 'OR'},
            {type: TokenType.TAG, key: 'coronaFree()', value: '<newzealand'},
          ],
          tagValues: {country: ['>canada'], 'coronaFree()': ['<newzealand']},
        },
      },
    ];

    for (const {name, string, object} of cases) {
      it(name, () => expect(tokenizeSearch(string)).toEqual(object));
    }
  });

  describe('stringifyQueryObject()', function() {
    const cases = [
      {
        name: 'should convert a basic object to a query string',
        object: new QueryResults(['is:unresolved']),
        string: 'is:unresolved',
      },
      {
        name: 'should quote tags with spaces',
        object: new QueryResults(['is:unresolved', 'browser:"Chrome 36"']),
        string: 'is:unresolved browser:"Chrome 36"',
      },
      {
        name: 'should stringify the query',
        object: new QueryResults(['python', 'is:unresolved', 'browser:"Chrome 36"']),
        string: 'python is:unresolved browser:"Chrome 36"',
      },
      {
        name: 'should join tokenized queries',
        object: new QueryResults(['python', 'exception']),
        string: 'python exception',
      },
      {
        name: 'should quote tags with spaces',
        object: new QueryResults([
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
        object: new QueryResults([
          'bad',
          'things',
          'repository_id:"UUID(\'long-value\')"',
        ]),
        string: 'bad things repository_id:"UUID(\'long-value\')"',
      },
      {
        name: 'should escape quote tags with double quotes',
        object: new QueryResults(['bad', 'things', 'name:"Ernest \\"Papa\\" Hemingway"']),
        string: 'bad things name:"Ernest \\"Papa\\" Hemingway"',
      },
      {
        name: 'should include blank strings',
        object: new QueryResults(['bad', 'things', 'name:""']),
        string: 'bad things name:""',
      },
      {
        name: 'correctly preserve boolean operators',
        object: new QueryResults(['country:canada', 'OR', 'country:newzealand']),
        string: 'country:canada OR country:newzealand',
      },
      {
        name: 'correctly preserve parens',
        object: new QueryResults([
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
        object: new QueryResults([
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
        string: '( a:a OR ( b:b AND c d e )) OR f g:g',
      },
      {
        name: 'correctly preserve filters with functions',
        object: new QueryResults(['country:>canada', 'OR', 'coronaFree():<newzealand']),
        string: 'country:>canada OR coronaFree():<newzealand',
      },
    ];

    for (const {name, string, object} of cases) {
      it(name, () => expect(stringifyQueryObject(object)).toEqual(string));
    }
  });
});
