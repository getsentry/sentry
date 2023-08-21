import type {ElementType} from 'react';
import styled from '@emotion/styled';

import SizingWindow from 'sentry/components/stories/sizingWindow';
import {space} from 'sentry/styles/space';

interface Props {
  component: ElementType;
  propMatrix: Record<string, any[]>;
}

export default function Matrix({component, propMatrix}: Props) {
  const selectedProps = ['priority', 'borderless'];

  const defaultValues = Object.fromEntries(
    Object.entries(propMatrix).map(([key, values]) => {
      return [key, values[0]];
    })
  );

  const values1 = propMatrix[selectedProps[0]];
  const values2 = propMatrix[selectedProps[1]];

  const renderList = values1.flatMap(value1 => {
    return values2.map(value2 => {
      return {
        ...defaultValues,
        [selectedProps[0]]: value1,
        [selectedProps[1]]: value2,
      };
    });
  });

  const hasChildren = 'children' in propMatrix;

  const Component = component;
  const items = hasChildren
    ? renderList.map(({children, ...props}) => (
        <Component key={props} {...props}>
          {children}
        </Component>
      ))
    : renderList.map(props => <Component key={props} {...props} />);

  return (
    <div>
      <ul>
        {Object.keys(propMatrix).map(key => (
          <li key={key}>{key}</li>
        ))}
      </ul>
      <SizingWindow>
        <Grid
          style={{
            gridTemplateColumns: `repeat(${values2.length}, max-content)`,
          }}
        >
          {items}
        </Grid>
      </SizingWindow>
    </div>
  );
}

const Grid = styled('div')`
  display: grid;
  gap: ${space(2)};
  align-items: center;
`;
