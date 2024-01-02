import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';

import JSXProperty from 'sentry/components/stories/jsxProperty';
import {space} from 'sentry/styles/space';

interface Props {
  name: string;
  children?: ReactNode;
  props?: Record<string, unknown>;
}

export default function JSXNode({name, props = {}, children}: Props) {
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
  font-size: ${p => p.theme.fontSizeMedium};
  padding-inline: 0;
  & > [data-property] {
    font-size: ${p => p.theme.fontSizeMedium};
    padding-inline: 0;
  }
  & > [data-node] {
    padding-left: ${space(2)};
  }
`;
