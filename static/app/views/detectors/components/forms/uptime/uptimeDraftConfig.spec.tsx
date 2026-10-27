import {UPTIME_DETECTOR_DRAFT_SCHEMA} from 'sentry/views/detectors/components/forms/uptime/uptimeDraftConfig';

const statusCheck = {
  id: 'status',
  op: 'status_code_check',
  operator: {cmp: 'less_than'},
  value: 300,
};

describe('UPTIME_DETECTOR_DRAFT_SCHEMA', () => {
  it('keeps a nested assertion tree', () => {
    const assertion = {
      root: {
        id: 'root',
        op: 'and',
        children: [
          statusCheck,
          {
            id: 'not',
            op: 'not',
            operand: {
              id: 'header',
              op: 'header_check',
              key_op: {cmp: 'equals'},
              key_operand: {header_op: 'literal', value: 'x-cache'},
              value_op: {cmp: 'equals'},
              value_operand: {header_op: 'glob', pattern: {value: 'MISS*'}},
            },
          },
        ],
      },
    };

    const values = UPTIME_DETECTOR_DRAFT_SCHEMA.parse({assertion});

    expect(values).toStrictEqual({assertion});
  });

  it('drops the assertion when any node is invalid', () => {
    const values = UPTIME_DETECTOR_DRAFT_SCHEMA.parse({
      assertion: {
        root: {id: 'root', op: 'and', children: [{...statusCheck, value: 'oops'}]},
      },
      url: 'https://example.com',
    });

    expect(values).toStrictEqual({assertion: undefined, url: 'https://example.com'});
  });

  it('restores a cleared status code as 200', () => {
    const values = UPTIME_DETECTOR_DRAFT_SCHEMA.parse({
      assertion: {
        root: {id: 'root', op: 'and', children: [{...statusCheck, value: null}]},
      },
    });

    expect(values.assertion?.root.children).toEqual([{...statusCheck, value: 200}]);
  });

  it('fills in a legacy JSON path assertion when it lacks an operator and operand', () => {
    const values = UPTIME_DETECTOR_DRAFT_SCHEMA.parse({
      assertion: {
        root: {
          id: 'root',
          op: 'and',
          children: [{id: 'json', op: 'json_path', value: '$.status'}],
        },
      },
    });

    expect(values.assertion?.root.children).toEqual([
      {
        id: 'json',
        op: 'json_path',
        operand: {jsonpath_op: 'literal', value: ''},
        operator: {cmp: 'equals'},
        value: '$.status',
      },
    ]);
  });

  it('drops methods and intervals the form does not offer', () => {
    const values = UPTIME_DETECTOR_DRAFT_SCHEMA.parse({
      intervalSeconds: 7,
      method: 'TRACE',
    });

    expect(values).toStrictEqual({intervalSeconds: undefined, method: undefined});
  });

  it('never restores headers or body', () => {
    const values = UPTIME_DETECTOR_DRAFT_SCHEMA.parse({
      body: 'secret',
      headers: [['Authorization', 'secret']],
    });

    expect(values).toStrictEqual({});
  });
});

describe('UPTIME_DETECTOR_DRAFT_SCHEMA url', () => {
  it.each([
    'https://user:secret@example.com/health',
    'https://admin:p@ssw0rd@example.com/x',
    '  https://user:secret@example.com',
    'https:/user:secret@example.com',
    'user:secret@example.com/health',
    'https://user:secret',
    'https://user:secretexample.com',
    'https://user:pa/ss@example.com',
    'https://user:pa?ss@example.com',
    'https://user:pa#ss@example.com',
    'user:secret',
    'user:pa/ss@example.com',
  ])('leaves out the URL when it may hold credentials, like %s', url => {
    expect(UPTIME_DETECTOR_DRAFT_SCHEMA.parse({name: 'Monitor', url})).toStrictEqual({
      name: 'Monitor',
      url: undefined,
    });
  });

  it.each([
    'https://example.com/health',
    'https://example.com:8080/health',
    'https://example.com/a@b',
    'https://example.com/health?email=a@b.com',
    'https://exa',
    'example.com/health',
    'localhost:8080/health',
  ])('keeps the URL when it has no credentials, like %s', url => {
    expect(UPTIME_DETECTOR_DRAFT_SCHEMA.parse({url})).toStrictEqual({url});
  });
});
