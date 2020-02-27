import React from 'react';
import styled from '@emotion/styled';

import SelectControl from 'app/components/forms/selectControl';
import {OrganizationSummary, SelectValue} from 'app/types';
import space from 'app/styles/space';

import {
  AGGREGATIONS,
  FIELDS,
  TRACING_FIELDS,
  Field,
  Aggregation,
} from '../eventQueryParams';
import {Column} from '../eventView';
import {AGGREGATE_ALIASES} from '../data';

type Props = {
  className?: string;
  organization: OrganizationSummary;
  parentIndex: number;
  column: Column;
  tagKeys: string[];
  onChange: (index: number, column: Column) => void;
};

type State = {
  fields: SelectValue<string>[];
  aggregations: string[];
};

class ColumnEditRow extends React.Component<Props, State> {
  state = {
    fields: generateOptions(Object.keys(FIELDS).concat(this.props.tagKeys)),
    aggregations: filterAggregations(this.props.organization, this.props.column.field),
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.tagKeys !== this.props.tagKeys) {
      this.syncFields();
    }
  }

  handleFieldChange = ({value}) => {
    this.setState((state: State, props: Props) => {
      const newAggregates = filterAggregations(props.organization, value);
      const newState = {...state, aggregations: newAggregates};
      let aggregation = props.column.aggregation;

      // If the new field makes the aggregation invalid, we should clear that state.
      if (aggregation && !newAggregates.includes(aggregation as Aggregation)) {
        aggregation = '';
      }
      this.triggerChange(value, aggregation as string);

      return newState;
    });
  };

  handleFunctionChange = ({value}) => {
    // TODO(mark) When we add improved tracing function support also clear
    // the function parameter as necessary.
    this.triggerChange(this.props.column.field, value);
  };

  triggerChange(field: string, aggregation: string) {
    const {parentIndex} = this.props;
    this.props.onChange(parentIndex, {
      field,
      aggregation,
    });
  }

  syncFields() {
    this.setState({
      fields: generateOptions(Object.keys(FIELDS).concat(this.props.tagKeys)),
    });
  }

  render() {
    const {fields, aggregations} = this.state;
    const {column, className} = this.props;

    return (
      <Container className={className}>
        <SelectControl
          options={fields}
          value={column.field}
          onChange={this.handleFieldChange}
        />
        <SelectControl
          options={generateOptions(aggregations)}
          value={column.aggregation}
          onChange={this.handleFunctionChange}
        />
      </Container>
    );
  }
}

function generateOptions(values: string[]): SelectValue<string>[] {
  return values.map(item => ({label: item, value: item}));
}

function filterAggregations(organization: OrganizationSummary, f?: Field): Aggregation[] {
  let functionList = Object.keys(AGGREGATIONS);
  if (!organization.features.includes('transaction-events')) {
    functionList = functionList.filter(item => !TRACING_FIELDS.includes(item));
  }

  // sort list in ascending order
  functionList.sort();

  if (!f) {
    return functionList as Aggregation[];
  }
  // Unknown fields are likely tag keys and thus strings.
  const fieldType = FIELDS[f] || 'string';

  if (fieldType === 'never') {
    return [];
  }

  // Aggregate aliases cannot be aggregated again.
  if (AGGREGATE_ALIASES.includes(f)) {
    return [];
  }

  functionList = functionList.reduce((accumulator, a) => {
    if (
      AGGREGATIONS[a].type.includes(fieldType) ||
      AGGREGATIONS[a].type === '*' ||
      fieldType === '*'
    ) {
      accumulator.push(a as Aggregation);
    }

    return accumulator;
  }, [] as Aggregation[]);

  // sort list in ascending order
  functionList.sort();

  return functionList as Aggregation[];
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-column-gap: ${space(1)};
  align-items: center;

  flex-grow: 1;
`;

export default ColumnEditRow;
