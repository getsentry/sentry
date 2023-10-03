import {type ElementType} from 'react';
import styled from '@emotion/styled';

import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {space} from 'sentry/styles/space';

interface Props {
  component: ElementType;
  propMatrix: Record<string, unknown[]>;
  selectedProps: [string, string];
}

export default function Matrix({component, propMatrix, selectedProps}: Props) {
  const defaultValues = Object.fromEntries(
    Object.entries(propMatrix).map(([key, values]) => {
      return [key, values[0]];
    })
  );

  const values1 = propMatrix[selectedProps[0]];
  const values2 = propMatrix[selectedProps[1]];

  const items = values1.flatMap(value1 => {
    const label = (
      <div>
        <JSXProperty name={String(selectedProps[0])} value={value1} />
      </div>
    );
    const content = values2.map(value2 => {
      return item(component, {
        ...defaultValues,
        [selectedProps[0]]: value1,
        [selectedProps[1]]: value2,
      });
    });
    return [label, ...content];
  });

  return (
    <div>
      <h4 style={{margin: 0}}>
        <samp>{selectedProps[0]}</samp> vs <samp>{selectedProps[1]}</samp>
      </h4>
      <Grid
        style={{
          gridTemplateColumns: `max-content repeat(${values2.length}, max-content)`,
        }}
      >
        <div key="space-head" />
        {values2.map(value2 => (
          <div key={`title-2-${value2}`}>
            <JSXProperty name={String(selectedProps[1])} value={value2} />
          </div>
        ))}
        {items}
      </Grid>
    </div>
  );
}

function item(Component, props) {
  const hasChildren = 'children' in props;

  return hasChildren ? (
    <SizingWindow key={JSON.stringify(props)}>
      <Component {...props}>{props.children}</Component>
    </SizingWindow>
  ) : (
    <SizingWindow key={JSON.stringify(props)}>
      <Component {...props} />
    </SizingWindow>
  );
}

const Grid = styled('section')`
  display: grid;
  gap: ${space(1)};
  align-items: center;
  padding: var(--stories-grid-space);
`;
