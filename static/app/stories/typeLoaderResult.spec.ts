// oxlint-disable-next-line import/no-nodejs-modules -- Execute generated loader modules in an isolated context.
import {runInNewContext} from 'node:vm';

import type {ComponentDoc, PropItem} from 'react-docgen-typescript';

import {serializeTypeLoaderResult} from 'sentry/stories/typeLoaderResult';

const inheritedProp: PropItem = {
  name: 'role',
  description: 'The ARIA role, including "button" and "link".\nInherited from React.',
  required: false,
  parent: {
    name: 'HTMLAttributes',
    fileName: '/checkout/node_modules/@types/react/index.d.ts',
  },
  type: {
    name: 'enum',
    raw: 'AriaRole',
    value: [{value: '"button"'}, {value: '"link"'}],
  },
  defaultValue: null,
  declarations: [
    {name: 'HTMLAttributes', fileName: '/checkout/node_modules/@types/react/index.d.ts'},
  ],
};

const component: ComponentDoc = {
  displayName: 'Button',
  description: 'A button.',
  filePath: '/checkout/static/app/button.tsx',
  methods: [],
  tags: {example: '<Button />'},
  props: {
    role: inheritedProp,
    label: {
      name: 'label',
      description: 'Button label.',
      required: true,
      type: {name: 'string'},
      defaultValue: null,
    },
  },
};

function loadDocumentation(result: TypeLoader.TypeLoaderResult) {
  const source = serializeTypeLoaderResult(result, '/checkout', (_context, file) =>
    file.replace('/checkout/', './')
  );
  // Evaluate the emitted module body, including its shared prop declarations.
  const documentation: TypeLoader.TypeLoaderResult = runInNewContext(
    source.replace('export default ', 'globalThis.documentation = ')
  );
  return {source, documentation};
}

describe('serializeTypeLoaderResult', () => {
  it('keeps displayed prop information and exports, without unused docgen metadata', () => {
    const exports = {
      module: '@sentry/scraps/button',
      exports: {Button: {name: 'Button', typeOnly: false}},
    };
    const {source, documentation} = loadDocumentation({
      props: {Button: component},
      exports,
    });

    expect(documentation).toEqual({
      props: {
        Button: {
          displayName: 'Button',
          description: 'A button.',
          props: {
            role: {
              name: 'role',
              description: inheritedProp.description,
              required: false,
              parent: {
                name: 'HTMLAttributes',
                fileName: './node_modules/@types/react/index.d.ts',
              },
              type: {name: 'enum', raw: 'AriaRole'},
            },
            label: {
              name: 'label',
              description: 'Button label.',
              required: true,
              type: {name: 'string'},
            },
          },
        },
      },
      exports,
    });
    expect(source).not.toContain('/checkout/');
    expect(source).not.toContain('declarations');
    expect(source).not.toContain('defaultValue');
    expect(source).not.toContain('tags');
    expect(source).not.toContain('filePath');
    expect(source).not.toContain('"value"');
  });

  it('shares identical props across compound components but preserves different types', () => {
    const {source, documentation} = loadDocumentation({
      props: {
        Button: component,
        'Button.Link': {...component, displayName: 'Button.Link'},
        Other: {
          ...component,
          displayName: 'Other',
          props: {role: {...inheritedProp, type: {name: 'string'}}},
        },
      },
    });

    const props = documentation.props!;
    expect(props.Button!.props.role).toBe(props['Button.Link']!.props.role);
    expect(props.Other!.props.role).not.toBe(props.Button!.props.role);
    expect(props.Other!.props.role!.type).toEqual({name: 'string'});
    // The repeated label is emitted once, and both components retain it.
    expect(source.match(/Button label\./g)).toHaveLength(1);
    expect(props['Button.Link']!.props.label).toEqual(props.Button!.props.label);
  });

  it('supports documentation without props', () => {
    const result = {exports: {module: '@sentry/scraps/button'}};
    expect(loadDocumentation(result).documentation).toEqual(result);
    expect(loadDocumentation({}).documentation).toEqual({});
  });
});
