import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

describe('utils/tokenizeSearch', function() {
  describe('tokenizeSearch()', function() {
    const cases = [
      {
        name: 'should convert a basic query string to a query object',
        string: 'is:unresolved',
        object: {query: [], is: ['unresolved']},
      },
      {
        name: 'should convert qutoed strings',
        string: 'is:unresolved browser:"Chrome 36"',
        object: {query: [], is: ['unresolved'], browser: ['Chrome 36']},
      },
      {
        name: 'should populate the text query',
        string: 'python is:unresolved browser:"Chrome 36"',
        object: {is: ['unresolved'], browser: ['Chrome 36'], query: ['python']},
      },
      {
        name: 'should tokenize the text query',
        string: 'python   exception',
        object: {query: ['python', 'exception']},
      },
      {
        name: 'should remove spaces in the query',
        string: 'python  is:unresolved exception',
        object: {is: ['unresolved'], query: ['python', 'exception']},
      },
      {
        name: 'should tokenize the quoted tags',
        string: 'event.type:error title:"QueryExecutionError: Code: 141."',
        object: {
          query: [],
          title: ['QueryExecutionError: Code: 141.'],
          'event.type': ['error'],
        },
      },
      {
        name: 'should tokenize words with :: in them',
        string: 'key:Resque::DirtyExit',
        object: {query: [], key: ['Resque::DirtyExit']},
      },
      {
        name: 'tokens that begin with a colon are still queries',
        string: 'country:canada :unresolved',
        object: {query: [':unresolved'], country: ['canada']},
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
        object: {query: [], is: ['unresolved']},
        string: 'is:unresolved',
      },
      {
        name: 'should quote tags with spaces',
        object: {query: [], is: ['unresolved'], browser: ['Chrome 36']},
        string: 'is:unresolved browser:"Chrome 36"',
      },
      {
        name: 'should stringify the query',
        object: {is: ['unresolved'], browser: ['Chrome 36'], query: ['python']},
        string: 'python is:unresolved browser:"Chrome 36"',
      },
      {
        name: 'should join tokenized queries',
        object: {query: ['python', 'exception']},
        string: 'python exception',
      },
      {
        name: 'should quote tags with spaces',
        object: {query: ['oh me', 'oh my'], browser: ['Chrome 36', 'Firefox 60']},
        string: 'oh me oh my browser:"Chrome 36" browser:"Firefox 60"',
      },
      {
        name: 'should quote tags with parens',
        object: {query: ['bad things'], repository_id: ["UUID('long-value')"]},
        string: 'bad things repository_id:"UUID(\'long-value\')"',
      },
      {
        name: 'should escape quote tags with double quotes',
        object: {query: ['bad things'], name: ['Ernest "Papa" Hemingway']},
        string: 'bad things name:"Ernest \\"Papa\\" Hemingway"',
      },
      {
        name: 'should include blank strings',
        object: {query: ['bad things'], name: ['']},
        string: 'bad things name:""',
      },
      {
        name: 'should include nulls',
        object: {query: ['bad things'], name: [null]},
        string: 'bad things name:""',
      },
    ];

    for (const {name, string, object} of cases) {
      it(name, () => expect(stringifyQueryObject(object)).toEqual(string));
    }
  });
});
