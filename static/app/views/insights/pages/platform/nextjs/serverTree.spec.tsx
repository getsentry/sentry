import {
  getFileAndFunctionName,
  mapResponseToTree,
} from 'sentry/views/insights/pages/platform/nextjs/serverTree';

describe('getFileAndFunctionName', () => {
  it('handles server components', () => {
    expect(getFileAndFunctionName('Page Server Component')).toEqual({
      file: 'page',
      functionName: 'Component',
    });
    expect(getFileAndFunctionName('Not-Found Server Component')).toEqual({
      file: 'not-found',
      functionName: 'Component',
    });
  });

  it('handles functions inside components', () => {
    expect(getFileAndFunctionName('Page.generateMetadata')).toEqual({
      file: 'page',
      functionName: 'generateMetadata',
    });
  });

  it('handles not pattern matching strings', () => {
    expect(getFileAndFunctionName('SomeFunction')).toEqual({
      file: null,
      functionName: 'SomeFunction',
    });
  });
});

describe('mapResponseToTree', () => {
  it('creates empty root folder for empty response', () => {
    expect(mapResponseToTree([])).toEqual({
      children: [],
      name: 'root',
      type: 'folder',
    });
  });

  it('handles single component with no path', () => {
    const response = [
      {
        'avg(span.duration)': 100,
        'count()': 1,
        'failure_rate()': 0,
        'p95(span.duration)': 100,
        'function.nextjs.component_type': 'Page Server Component',
        'function.nextjs.path': [],
        'span.description': 'desc',
      },
    ];

    expect(mapResponseToTree(response)).toEqual({
      children: [
        {
          children: [
            {
              name: 'Component',
              type: 'component',
              'avg(span.duration)': 100,
              'count()': 1,
              'failure_rate()': 0,
              'p95(span.duration)': 100,
              'span.description': 'desc',
              query: 'span.description:"desc" span.op:function.nextjs',
            },
          ],
          name: 'page',
          type: 'file',
          query: 'transaction:"GET /page" span.op:function.nextjs',
        },
      ],
      name: 'root',
      type: 'folder',
      query: undefined,
    });
  });

  it('handles nested paths with multiple components', () => {
    const response = [
      {
        'avg(span.duration)': 100,
        'count()': 1,
        'failure_rate()': 0,
        'p95(span.duration)': 100,
        'function.nextjs.component_type': 'Page.getData',
        'function.nextjs.path': ['app', 'users'],
        'span.description': 'desc1',
      },
      {
        'avg(span.duration)': 200,
        'count()': 500,
        'failure_rate()': 0.01,
        'p95(span.duration)': 200,
        'function.nextjs.component_type': 'Layout Server Component',
        'function.nextjs.path': ['app'],
        'span.description': 'desc2',
      },
    ];

    expect(mapResponseToTree(response)).toEqual({
      children: [
        {
          children: [
            {
              children: [
                {
                  children: [
                    {
                      name: 'getData',
                      type: 'component',
                      'avg(span.duration)': 100,
                      'count()': 1,
                      'failure_rate()': 0,
                      'p95(span.duration)': 100,
                      'span.description': 'desc1',
                      query: 'span.description:"desc1" span.op:function.nextjs',
                    },
                  ],
                  name: 'page',
                  type: 'file',
                  query: 'transaction:"GET /app/users/page" span.op:function.nextjs',
                },
              ],
              name: 'users',
              type: 'folder',
              query: undefined,
            },
            {
              children: [
                {
                  name: 'Component',
                  type: 'component',
                  'avg(span.duration)': 200,
                  'count()': 500,
                  'failure_rate()': 0.01,
                  'p95(span.duration)': 200,
                  'span.description': 'desc2',
                  query: 'span.description:"desc2" span.op:function.nextjs',
                },
              ],
              name: 'layout',
              type: 'file',
              query: 'transaction:"GET /app/layout" span.op:function.nextjs',
            },
          ],
          name: 'app',
          type: 'folder',
          query: undefined,
        },
      ],
      name: 'root',
      type: 'folder',
      query: undefined,
    });
  });

  it('does not decode URL encoded path segments', () => {
    const response = [
      {
        'avg(span.duration)': 100,
        'count()': 1,
        'failure_rate()': 0,
        'p95(span.duration)': 100,
        'function.nextjs.component_type': 'Page Server Component',
        'function.nextjs.path': ['app', 'user%20profile'],
        'span.description': 'desc',
      },
    ];

    expect(mapResponseToTree(response)).toEqual({
      children: [
        {
          children: [
            {
              children: [
                {
                  children: [
                    {
                      name: 'Component',
                      type: 'component',
                      'avg(span.duration)': 100,
                      'count()': 1,
                      'failure_rate()': 0,
                      'p95(span.duration)': 100,
                      'span.description': 'desc',
                      query: 'span.description:"desc" span.op:function.nextjs',
                    },
                  ],
                  name: 'page',
                  type: 'file',
                  query:
                    'transaction:"GET /app/user%20profile/page" span.op:function.nextjs',
                },
              ],
              name: 'user%20profile',
              type: 'folder',
              query: undefined,
            },
          ],
          name: 'app',
          type: 'folder',
          query: undefined,
        },
      ],
      name: 'root',
      type: 'folder',
      query: undefined,
    });
  });
});
