import {isValidElement} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {JSXProperty} from './jsx';
import {SizingWindow} from './layout';

export type PropMatrix<P> = Partial<{
  [Prop in keyof P]: Array<P[Prop]>;
}>;

interface PropMatrixProps<P> {
  propMatrix: PropMatrix<P>;
  render: React.ElementType<P>;
  selectedProps: [keyof P] | [keyof P, keyof P];
}

export function PropMatrix<P>({propMatrix, render, selectedProps}: PropMatrixProps<P>) {
  const defaultValues = Object.fromEntries(
    Object.entries(propMatrix).map(([key, values]) => {
      return [key, (values as any[]).at(0)];
    })
  );

  const values1 = propMatrix[selectedProps[0]] ?? [];
  const values2 = selectedProps.length === 2 ? propMatrix[selectedProps[1]] : undefined;

  const items = values1.flatMap(value1 => {
    const label = (
      <div>
        <JSXProperty name={String(selectedProps[0])} value={value1} />
      </div>
    );

    const content = (values2 ?? ['']).map(value2 => {
      return item(
        render,
        {
          ...defaultValues,
          [selectedProps[0]]: value1,
          ...(selectedProps.length === 2 ? {[selectedProps[1]]: value2} : {}),
        },
        {}
      );
    });
    return [label, ...content];
  });

  return (
    <div>
      {selectedProps.length === 2 ? (
        <Title>
          <samp>{selectedProps[0] as string | number}</samp> vs{' '}
          <samp>{selectedProps[1] as string | number}</samp>
        </Title>
      ) : (
        <Title>
          <samp>{selectedProps[0] as string | number}</samp>
        </Title>
      )}
      <Grid
        style={{
          gridTemplateColumns: `max-content repeat(${values2?.length ?? 1}, max-content)`,
        }}
      >
        {values2 ? <div key="space-head" /> : null}
        {values2?.map(value2 => (
          <div key={`title-2-${value2}`}>
            <JSXProperty name={String(selectedProps[1])} value={value2} />
          </div>
        ))}
        {items}
      </Grid>
    </div>
  );
}

function item(Component: any, props: any, sizingWindowProps: any) {
  const hasChildren = 'children' in props;

  const replacer = (_key: string, value: any) => {
    if (isValidElement(value)) {
      return 'react'; // value.name ?? value;
    }
    return value;
  };

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

const Title = styled('h4')`
  margin: 0;
  scroll-margin-top: ${space(2)};
`;

const Grid = styled('section')`
  display: grid;
  gap: ${space(1)};
  align-items: center;
  padding: var(--stories-grid-space);
  overflow-x: auto;
`;
