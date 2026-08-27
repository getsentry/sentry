import {extractRequest, serializeTypeLoaderResult} from 'sentry/stories/typeLoader';

function makeTypeLoaderResult(rootContext: string, syntheticProperty: string) {
  const componentPath = `${rootContext}/app/components/core/example.tsx`;

  return {
    props: {
      Example: {
        displayName: 'Example',
        filePath: componentPath,
        filename: componentPath,
        props: {
          label: {
            name: 'label',
            parent: {
              fileName: componentPath,
              name: 'ExampleProps',
            },
          },
          [syntheticProperty]: {
            name: syntheticProperty,
          },
        },
      },
    },
  } as unknown as TypeLoader.TypeLoaderResult;
}

describe('serializeTypeLoaderResult', () => {
  it('stabilizes TypeScript properties and checkout paths', () => {
    const firstRoot = '/home/first/sentry/static';
    const secondRoot = '/different/checkout/sentry/static';
    const contextify = (context: string, request: string) =>
      `./${request.slice(context.length + 1)}`;

    const first = serializeTypeLoaderResult(
      makeTypeLoaderResult(firstRoot, '__@iterator@123'),
      firstRoot,
      contextify
    );
    const second = serializeTypeLoaderResult(
      makeTypeLoaderResult(secondRoot, '__@iterator@987'),
      secondRoot,
      contextify
    );

    expect(first).toBe(second);
    expect(first).not.toContain('__@iterator');
    expect(first).not.toContain(firstRoot);
    expect(JSON.parse(first)).toMatchObject({
      props: {
        Example: {
          filePath: './app/components/core/example.tsx',
          filename: './app/components/core/example.tsx',
          props: {
            label: {
              parent: {
                fileName: './app/components/core/example.tsx',
              },
            },
          },
        },
      },
    });
  });
});

describe('extractRequest', () => {
  const rootContext = '/checkout/sentry/static';
  const contextify = (context: string, request: string) =>
    `./${request.slice(context.length + 1)}`;

  it.each([
    [
      '/checkout/sentry/static/app/components/core/button/index.tsx',
      '@sentry/scraps/button',
    ],
    [
      '/checkout/sentry/static/app/components/dropdownMenu/index.tsx',
      'sentry/components/dropdownMenu',
    ],
    [
      '/checkout/sentry/static/app/views/dashboards/widgets/widget/widget.tsx',
      'sentry/views/dashboards/widgets/widget/widget',
    ],
  ])('creates the public request for %s', (resourcePath, expected) => {
    expect(extractRequest(resourcePath, rootContext, contextify)).toBe(expected);
  });
});
