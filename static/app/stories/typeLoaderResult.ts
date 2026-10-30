import type {LoaderContext} from '@rspack/core';

/** Emit only the fields used by APIReference, sharing identical inherited props. */
export function serializeTypeLoaderResult(
  result: TypeLoader.TypeLoaderResult,
  rootContext: string,
  contextify: LoaderContext['utils']['contextify']
): string {
  const serialize = (value: unknown) =>
    JSON.stringify(value, (key, item) =>
      key === 'fileName' && typeof item === 'string'
        ? contextify(rootContext, item)
        : item
    );

  const propCounts = new Map<string, number>();
  const components = Object.entries(result.props ?? {}).map(([name, component]) => {
    const props = Object.entries(component.props).map(([propName, prop]) => {
      const serialized = serialize({
        name: prop.name,
        description: prop.description,
        required: prop.required,
        parent: prop.parent,
        type: {name: prop.type.name, raw: prop.type.raw},
      });
      propCounts.set(serialized, (propCounts.get(serialized) ?? 0) + 1);
      return [propName, serialized] as const;
    });

    return {name, component, props};
  });

  // Compound components repeat hundreds of HTML and ARIA props. Keep their data
  // once per module without removing inherited props from search or grouping.
  const sharedProps = new Map(
    [...propCounts].filter(([, count]) => count > 1).map(([prop], i) => [prop, i])
  );
  const fields: string[] = [];

  if (result.props) {
    const props = components.map(({name, component, props: componentProps}) => {
      const propsSource = componentProps.map(([propName, prop]) => {
        const sharedIndex = sharedProps.get(prop);
        return `${serialize(propName)}:${sharedIndex === undefined ? prop : `props[${sharedIndex}]`}`;
      });
      return `${serialize(name)}:{"displayName":${serialize(component.displayName)},"description":${serialize(component.description)},"props":{${propsSource.join(',')}}}`;
    });
    fields.push(`"props":{${props.join(',')}}`);
  }

  if (result.exports) {
    fields.push(`"exports":${serialize(result.exports)}`);
  }

  const declarations = sharedProps.size
    ? `const props = [${[...sharedProps.keys()].join(',')}];\n`
    : '';
  return `${declarations}export default {${fields.join(',')}};`;
}
