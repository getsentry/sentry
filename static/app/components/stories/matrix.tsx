import {type ElementType} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
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
    const label = <div>{`${selectedProps[0]}=${value1}`}</div>;
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
    <Panel style={{padding: space(2)}}>
      <Grid
        style={{
          gridTemplateColumns: `max-content repeat(${values2.length}, max-content)`,
        }}
      >
        <div key="space-head" />
        {values2.map(v => (
          <div key={`title-2-${v}`}>{`${selectedProps[1]}=${v}`}</div>
        ))}
        {items}
      </Grid>
    </Panel>
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
`;
