import {isValidElement} from 'react';

import JSXNode from 'sentry/components/stories/jsxNode';

interface Props {
  name: string;
  value: unknown;
}

export default function JSXProperty({name, value}: Props) {
  if (name === 'children') {
    return <code data-property="children">{`{children}`}</code>;
  }
  if (value === null || value === undefined) {
    return <code data-property="nullish">{`${name}={${value}}`}</code>;
  }
  if (value === true) {
    return <code data-property="boolean">{name}</code>;
  }
  if (value === false) {
    return <code data-property="boolean">{`${name}={${value}}`}</code>;
  }
  if (value === Number || value === Boolean || value === Function) {
    // @ts-expect-error
    return <code data-property="constructor">{`${name}={${value.name}}`}</code>;
  }
  if (typeof value === 'string') {
    return <code data-property="string">{`${name}=${JSON.stringify(value)}`}</code>;
  }
  if (typeof value === 'number') {
    return <code data-property="number">{`${name}={${value}}`}</code>;
  }
  if (typeof value === 'function') {
    return (
      <code data-property="function">{`${name}={${value.name || 'Function'}}`}</code>
    );
  }
  if (isValidElement(value)) {
    if (value.type === JSXNode) {
      return <code data-property="element">{[`${name}={`, value, '}']}</code>;
    }
    return <code data-property="element">{`${name}=${value}`}</code>;
  }
  return <code data-property="object">{`${name}={${JSON.stringify(value)}}`}</code>;
}
