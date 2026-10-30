// oxlint-disable-next-line import/no-nodejs-modules -- Execute the generated loader module in an isolated context.
import {runInNewContext} from 'node:vm';

import {serializeTypeLoaderResult} from 'sentry/stories/typeLoaderResult';

it('emits a module with working shared prop references', () => {
  const component: TypeLoader.ComponentDoc = {
    displayName: 'Button',
    description: 'A button.',
    props: {
      label: {
        name: 'label',
        description: 'The visible label.',
        required: true,
        type: {name: 'string'},
      },
    },
  };
  const source = serializeTypeLoaderResult(
    {props: {Button: component, LinkButton: component}},
    '/checkout',
    (_context, file) => file
  );
  const result: TypeLoader.TypeLoaderResult = runInNewContext(
    source.replace('export default ', 'globalThis.documentation = ')
  );

  expect(result.props!.Button!.props.label).toEqual(component.props.label);
  expect(result.props!.LinkButton!.props.label).toBe(result.props!.Button!.props.label);
});
