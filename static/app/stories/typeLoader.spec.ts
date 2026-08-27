import {serializeTypeLoaderResult} from 'sentry/stories/typeLoader';

function makeTypeLoaderResult(rootContext: string, syntheticProperty: string) {
  const componentPath = `${rootContext}/static/app/components/core/example.tsx`;

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
    const firstRoot = '/home/first/sentry';
    const secondRoot = '/different/checkout/sentry';
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
          filePath: './static/app/components/core/example.tsx',
          filename: './static/app/components/core/example.tsx',
          props: {
            label: {
              parent: {
                fileName: './static/app/components/core/example.tsx',
              },
            },
          },
        },
      },
    });
  });
});
