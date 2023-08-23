import {type ElementType, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {InputGroup} from 'sentry/components/inputGroup';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {space} from 'sentry/styles/space';

interface Props {
  component: ElementType;
  propMatrix: Record<string, unknown[]>;
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
        <SizingWindow key={JSON.stringify(props)}>
          <Component {...props}>{children}</Component>
        </SizingWindow>
      ))
    : renderList.map(props => (
        <SizingWindow key={JSON.stringify(props)}>
          <Component {...props} />
        </SizingWindow>
      ));

  return (
    <form onSubmit={() => {}}>
      <InputGroup>
        <ul>
          {Object.keys(propMatrix).map(key => (
            <li key={key}>
              {key}
              <InputForType prop={key} values={propMatrix[key]} />
            </li>
          ))}
        </ul>
      </InputGroup>

      <Grid
        style={{
          gridTemplateColumns: `repeat(${values2.length}, max-content)`,
        }}
      >
        {items}
      </Grid>
    </form>
  );
}

function InputForType(key: string, values: unknown[]) {
  const isAllString = areAllString(values);
  const isAllNumber = areAllNumber(values);
  const isAllBoolean = areAllBoolean(values);

  const [value, setValue] = useState<string>('');

  if (isAllString || isAllNumber || isAllBoolean) {
    return (
      <CompactSelect
        triggerLabel={key}
        onChange={selected => setValue(selected.value)}
        options={values.map(v => ({
          label: toLabel(v),
          value: toLabel(v),
        }))}
        size="sm"
        value={value}
      />
    );
  }
  return <InputGroup.Input />;
}

function areAllString(values: unknown[]): values is string[] {
  return values.every(val => typeof val === 'string');
}
function areAllNumber(values: unknown[]): values is number[] {
  return values.every(val => typeof val === 'number');
}
function areAllBoolean(values: unknown[]): values is boolean[] {
  return values.every(val => typeof val === 'boolean');
}

function toLabel(value: string | boolean | number) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

const Grid = styled('div')`
  display: grid;
  gap: ${space(2)};
  align-items: center;
`;
