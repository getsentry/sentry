import utils, {
  _decodeQueryValueToObject,
  _encodeObjectToQueryValue,
} from 'app/utils/queryString';

describe('addQueryParamsToExistingUrl', function() {
  it('adds new query params to existing query params', function() {
    const url = 'https://example.com?value=3';
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4&value=3'
    );
  });

  it('adds new query params without existing query params', function() {
    const url = 'https://example.com';
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe(
      'https://example.com/?id=4'
    );
  });

  it('returns empty string no url is passed', function() {
    let url;
    const newParams = {
      id: 4,
    };
    expect(utils.addQueryParamsToExistingUrl(url, newParams)).toBe('');
  });
});

/*
describe('addKeyValueToQueryString', function() {
  let locationQuery;

  it('adds to Query', function() {
    locationQuery = {};

    const result = utils.addKeyValueToQueryString(locationQuery, 'color', 'red');
    expect(result).toEqual({color: 'red'});
  });

  it('adds to Query with null', function() {
    locationQuery = {color: null};

    const result = utils.addKeyValueToQueryString(locationQuery, 'color', 'red');
    expect(result).toEqual({color: 'red'});
  });

  it('is idempotent for Query input', function() {
    locationQuery = {};

    const result1 = utils.addKeyValueToQueryString(locationQuery, 'color', 'red');
    expect(result1).toEqual({color: 'red'});
    expect(result1).not.toBe(locationQuery);

    const result2 = utils.addKeyValueToQueryString(locationQuery, 'size', 'small');
    expect(result2).toEqual({size: 'small'});
    expect(result2).not.toEqual(expect.objectContaining({color: 'red'}));
  });

  it('wraps values with spaces', function() {
    locationQuery = {};

    const result = utils.addKeyValueToQueryString(locationQuery, 'color', 'green red');
    expect(result).toEqual({color: '"green red"'});
  });

  it('wraps values with colon', function() {
    locationQuery = {};

    const result1 = utils.addKeyValueToQueryString(locationQuery, 'color', 'green:red');
    expect(result1).toEqual({color: '"green:red"'});

    const result2 = utils.addKeyValueToQueryString(locationQuery, 'color', '"green:red"');
    expect(result2).toEqual({color: '"green:red"'});
  });

  it('adds to Query by replacing existing values', function() {
    locationQuery = {color: 'green'};

    const result = utils.addKeyValueToQueryString(locationQuery, 'color', 'red');
    expect(result).toEqual({color: 'red'});
  });

  it('uses addKeyValueToQueryStringQuery appending to Query.query', function() {
    locationQuery = {color: 'red', query: 'red'};

    const result = utils.addKeyValueToQueryString(locationQuery, 'query', 'green');
    expect(result).toEqual({color: 'red', query: 'red green'});
  });

  it('does not error out if query is undefined', function() {
    locationQuery = undefined;

    const result = utils.addKeyValueToQueryString(locationQuery, 'color', 'red');
    expect(result).toEqual({color: 'red'});
  });
});

describe('addKeyValueToQueryStringQuery', function() {
  let locationQuery;

  it('adds key-value to Query.query', function() {
    locationQuery = {};
    const result = utils.addKeyValueToQueryStringQuery(locationQuery, 'red');

    expect(result).toEqual({query: 'red'});
  });

  it('wraps key-value that has spaces', function() {
    locationQuery = {};
    const result = utils.addKeyValueToQueryStringQuery(locationQuery, 'green red');

    expect(result).toEqual({query: '"green red"'});
  });

  it('adds key-value to Query.query, replacing existing key-value pairs with the same key', function() {
    locationQuery = {query: 'color:green taste:sweet color:pink'};
    const result = utils.addKeyValueToQueryStringQuery(locationQuery, 'color:red');

    expect(result).toEqual({query: 'color:red taste:sweet'});
  });

  it('adds key-value to Query.query by appending if it has no keys', function() {
    locationQuery = {query: 'green'};
    const result = utils.addKeyValueToQueryStringQuery(locationQuery, 'red');

    expect(result).toEqual({query: 'green red'});
  });
});

describe('decodeQueryValueToObject', function() {
  it('decodes when Query.query is a string', function() {
    const queryQuery = 'tag:value';
    const decodedQuery = _decodeQueryValueToObject(queryQuery);

    expect(decodedQuery).toEqual({
      tag: 'value',
    });
  });

  it('decodes when Query.query is an array of strings', function() {
    const queryQuery = 'tag:value';
    const decodedQuery = _decodeQueryValueToObject(queryQuery);

    expect(decodedQuery).toEqual({
      tag: 'value',
    });
  });

  it('decodes when Query.query is falsey', function() {
    const queryQuery = 'tag:value';
    const decodedQuery = _decodeQueryValueToObject(queryQuery);

    expect(decodedQuery).toEqual({
      tag: 'value',
    });
  });

  describe('decodes when Query.query has multiple values', function() {
    it('key0:foo key1:foo', function() {
      const queryQuery = 'key0:foo key1:bar';
      const decodedQuery = _decodeQueryValueToObject(queryQuery);

      expect(decodedQuery).toEqual({
        key0: 'foo',
        key1: 'bar',
      });
    });

    describe('decodes odd cases for keys', function() {
      it('key.0:foo key1:foo', function() {
        const queryQuery = 'key0:foo key1:bar';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          key0: 'foo',
          key1: 'bar',
        });
      });

      it('"key:0":foo key1:foo', function() {
        const queryQuery = '"key:0":foo key1:bar';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          '"key:0"': 'foo',
          key1: 'bar',
        });
      });

      it('"k.e.y:0":foo key1:foo', function() {
        const queryQuery = '"k.e.y:0":foo key1:bar';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          '"k.e.y:0"': 'foo',
          key1: 'bar',
        });
      });
    });

    describe('decodes odd cases for values', function() {
      it('key0:foo key1:"foo bar"', function() {
        const queryQuery = 'key0:foo key1:"foo bar"';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          key0: 'foo',
          key1: '"foo bar"',
        });
      });

      it('key0:foo key1:"id:1"', function() {
        const queryQuery = 'key0:foo key1:"id:1"';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          key0: 'foo',
          key1: '"id:1"',
        });
      });

      it('key0:foo key1:"id:\\"foo bar\\""', function() {
        const queryQuery = 'key0:foo key1:"id:\\"foo bar\\""';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          key0: 'foo',
          key1: '"id:\\"foo bar\\""',
        });
      });
    });

    describe('decodes odd cases for key and values', function() {
      it('"k.e.y:0":foo key1:"id:\\"foo bar\\"" "k.e.y:2":"id:\\"foo bar\\""', function() {
        const queryQuery =
          '"k.e.y:0":foo key1:"id:\\"foo bar\\"" "k.e.y:2":"id:\\"foo bar\\""';
        const decodedQuery = _decodeQueryValueToObject(queryQuery);

        expect(decodedQuery).toEqual({
          '"k.e.y:0"': 'foo',
          key1: '"id:\\"foo bar\\""',
          '"k.e.y:2"': '"id:\\"foo bar\\""',
        });
      });
    });
  });
});
*/

describe('encodeObjectToQueryValue', function() {
  it('encodes when a key-value is a string', function() {
    const queryObject = {
      key0: 'foo',
      'key.1': 'foo',
    };
    const encodedQuery = _encodeObjectToQueryValue(queryObject);

    expect(encodedQuery).toBe('key0:foo key.1:foo');
  });

  it('encodes odd cases for keys', function() {
    const queryObject = {
      key0: 'foo',
      '"key:1"': 'foo',
      '"k.e.y:2"': 'foo',
    };
    const encodedQuery = _encodeObjectToQueryValue(queryObject);

    expect(encodedQuery).toBe('key0:foo "key:1":foo "k.e.y:2":foo');
  });

  it('encodes odd cases for keys that was not quoted', function() {
    const queryObject = {
      key0: 'foo',
      'key:1': 'foo',
      'k.e.y:2': 'foo',
    };
    const encodedQuery = _encodeObjectToQueryValue(queryObject);

    expect(encodedQuery).toBe('key0:foo "key:1":foo "k.e.y:2":foo');
  });

  it('encodes odd cases for values', function() {
    const queryObject = {
      key0: 'foo',
      key1: '"foo bar"',
      key2: '"id:1"',
      key3: '"id:\\"foo bar\\""',
    };
    const encodedQuery = _encodeObjectToQueryValue(queryObject);

    expect(encodedQuery).toBe(
      'key0:foo key1:"foo bar" key2:"id:1" key3:"id:\\"foo bar\\""'
    );
  });

  it('encodes odd cases for values that was not quoted', function() {
    const queryObject = {
      key0: 'foo',
      key1: 'foo bar',
      key2: 'id:1',
      key3: 'id:foo bar',
    };
    const encodedQuery = _encodeObjectToQueryValue(queryObject);

    expect(encodedQuery).toBe(
      'key0:foo key1:"foo bar" key2:"id:1" key3:"id:\\"foo bar\\""'
    );
  });

  it('encodes odd cases for key and values', function() {
    const queryObject = {
      key0: 'foo',
      'key:1': 'foo bar',
      'key:2': 'id:1',
      'k.e.y:3': 'id:foo bar',
    };
    const encodedQuery = _encodeObjectToQueryValue(queryObject);

    expect(encodedQuery).toBe(
      'key0:foo key1:"foo bar" key2:"id:1" key3:"id:\\"foo bar\\"" "k.e.y:3":"id:\\"foo bar\\""'
    );
  });
});
