import {
  getFileAndFunctionName,
  mapResponseToTree,
} from 'sentry/views/insights/pages/platform/nextjs/ssrTreeWidget';

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
              'span.description': 'desc',
            },
          ],
          name: 'page',
          type: 'file',
        },
      ],
      name: 'root',
      type: 'folder',
    });
  });

  it('handles nested paths with multiple components', () => {
    const response = [
      {
        'avg(span.duration)': 100,
        'function.nextjs.component_type': 'Page.getData',
        'function.nextjs.path': ['app', 'users'],
        'span.description': 'desc1',
      },
      {
        'avg(span.duration)': 200,
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
                      'span.description': 'desc1',
                    },
                  ],
                  name: 'page',
                  type: 'file',
                },
              ],
              name: 'users',
              type: 'folder',
            },
            {
              children: [
                {
                  name: 'Component',
                  type: 'component',
                  'avg(span.duration)': 200,
                  'span.description': 'desc2',
                },
              ],
              name: 'layout',
              type: 'file',
            },
          ],
          name: 'app',
          type: 'folder',
        },
      ],
      name: 'root',
      type: 'folder',
    });
  });

  it('does not decode URL encoded path segments', () => {
    const response = [
      {
        'avg(span.duration)': 100,
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
                      'span.description': 'desc',
                    },
                  ],
                  name: 'page',
                  type: 'file',
                },
              ],
              name: 'user%20profile',
              type: 'folder',
            },
          ],
          name: 'app',
          type: 'folder',
        },
      ],
      name: 'root',
      type: 'folder',
    });
  });
});
