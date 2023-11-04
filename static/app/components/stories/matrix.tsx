import {type ElementType, isValidElement} from 'react';
import styled from '@emotion/styled';
import first from 'lodash/first';

import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow, {
  Props as SizingWindowProps,
} from 'sentry/components/stories/sizingWindow';
import {space} from 'sentry/styles/space';

type RenderProps = {};

export type PropMatrix<P extends RenderProps> = Partial<{
  [Prop in keyof P]: P[Prop][];
}>;

interface Props<P extends RenderProps> {
  propMatrix: PropMatrix<P>;
  render: ElementType<P>;
  selectedProps: [keyof P, keyof P];
  sizingWindowProps?: SizingWindowProps;
}

export default function Matrix<P extends RenderProps>({
  propMatrix,
  render,
  selectedProps,
  sizingWindowProps,
}: Props<P>) {
  const defaultValues = Object.fromEntries(
    Object.entries(propMatrix).map(([key, values]) => {
      return [key, first(values as any)];
    })
  );

  const values1 = propMatrix[selectedProps[0]] ?? [];
  const values2 = propMatrix[selectedProps[1]] ?? [];

  const items = values1.flatMap(value1 => {
    const label = (
      <div>
        <JSXProperty name={String(selectedProps[0])} value={value1} />
      </div>
    );
    const content = values2.map(value2 => {
      return item(
        render,
        {
          ...defaultValues,
          [selectedProps[0]]: value1,
          [selectedProps[1]]: value2,
        },
        sizingWindowProps
      );
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

// ((this: any, key: string, value: any) => any)
function replacer(this: any, _key: string, value: any) {
  if (isValidElement(value)) {
    return 'react'; // value.name ?? value;
  }
  return value;
}

function item(Component, props, sizingWindowProps) {
  const hasChildren = 'children' in props;

  if (hasChildren) {
    const {children, ...otherProps} = props;
    return (
      <SizingWindow key={JSON.stringify(otherProps, replacer)} {...sizingWindowProps}>
        <Component {...otherProps}>{children}</Component>
      </SizingWindow>
    );
  }

  return (
    <SizingWindow key={JSON.stringify(props, replacer)} {...sizingWindowProps}>
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
