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
  organization: OrganizationSummary;
  parentIndex: number;
  column: Column;
  tagKeys: string[];
  onChange: (index: number, column: Column) => void;
};

type State = {
  field: string;
  fields: SelectValue<string>[];
  aggregation: Aggregation;
  aggregations: string[];
};

class ColumnEditRow extends React.Component<Props, State> {
  state = {
    field: this.props.column.field,
    fields: generateOptions(Object.keys(FIELDS).concat(this.props.tagKeys)),
    aggregation: this.props.column.aggregation as Aggregation,
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
      const newState = {...state, field: value, aggregations: newAggregates};

      // If the new field makes the aggregation invalid, we should clear that state.
      if (state.aggregation && !newAggregates.includes(state.aggregation)) {
        // TODO(mark) Figure out why react-select isn't wiping the text value when this happens.
        newState.aggregation = '';
      }
      return newState;
    }, this.triggerChange);
  };

  handleFunctionChange = ({value}) => {
    // TODO(mark) When we add improved tracing function support also clear
    // the function parameter as necessary.
    this.setState({aggregation: value}, this.triggerChange);
  };

  triggerChange() {
    const {parentIndex} = this.props;
    const {field, aggregation} = this.state;
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
    const {field, fields, aggregation, aggregations} = this.state;

    return (
      <RowContainer>
        <SelectControl options={fields} value={field} onChange={this.handleFieldChange} />
        <SelectControl
          options={aggregations.map(item => ({label: item, value: item}))}
          value={aggregation}
          onChange={this.handleFunctionChange}
        />
      </RowContainer>
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

const RowContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 50%);
  grid-column-gap: ${space(2)};
  align-items: center;
`;

export default ColumnEditRow;
