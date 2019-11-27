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
    ];

    for (const {name, string, object} of cases) {
      it(name, () => expect(stringifyQueryObject(object)).toEqual(string));
    }
  });
});
