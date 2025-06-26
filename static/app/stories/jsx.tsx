import type {ReactNode} from 'react';
import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

interface JSXNodeProps {
  name: string;
  children?: ReactNode;
  props?: Record<string, unknown>;
}

export function JSXNode({name, props = {}, children}: JSXNodeProps) {
  if (children) {
    return (
      <Code data-node>
        {`<${name}`}
        {Object.entries(props).map(([propName, value]) => (
          <Fragment key={propName}>
            {' '}
            <JSXProperty name={propName} value={value} />
          </Fragment>
        ))}
        {`>`}
        <br />
        {children}
        <br />
        {`</${name}>`}
      </Code>
    );
  }
  return (
    <Code data-node>
      {`<${name} `}
      {Object.entries(props).map(([propName, value]) => (
        <Fragment key={propName}>
          <JSXProperty name={propName} value={value} />{' '}
        </Fragment>
      ))}
      {`/>`}
    </Code>
  );
}

const Code = styled('code')`
  font-size: ${p => p.theme.fontSize.md};
  padding-inline: 0;
  & > [data-property] {
    font-size: ${p => p.theme.fontSize.md};
    padding-inline: 0;
  }
  & > [data-node] {
    padding-left: ${space(2)};
  }
`;

interface JSXPropertyProps {
  name: string;
  value: unknown;
}

export function JSXProperty({name, value}: JSXPropertyProps) {
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
    // @ts-expect-error TS(2339): Property 'name' does not exist on type 'object'.
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
    return (
      <code data-property="element">
        {`${name}=`}
        {value}
      </code>
    );
  }
  return <code data-property="object">{`${name}={${JSON.stringify(value)}}`}</code>;
}
