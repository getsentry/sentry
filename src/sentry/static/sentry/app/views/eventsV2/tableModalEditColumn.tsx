import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {Form, SelectField, TextField} from 'app/components/forms';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

import {AGGREGATIONS, FIELDS, Aggregation, Field} from './eventQueryParams';
import {TableColumn} from './tableTypes';

type ModalEditColumnFormProps = {
  column: {
    aggregation: Aggregation;
    field: Field;
    name: string;
  };

  actions: {
    createColumn: {(): void};
    updateColumn: {(column, indexOfColumnOrder: number): void};
  };
};
type ModalEditColumnFormState = {
  currAggregation: Aggregation;
  currField: Field;
  currName: string;
  aggregations: Aggregation[];
  fields: Field[];
};

class ModalEditColumnForm extends React.Component<
  ModalEditColumnFormProps,
  ModalEditColumnFormState
> {
  static defaultProps = {
    column: {
      aggregation: '',
      field: '',
      name: '',
    },
  };

  state = {
    currAggregation: this.props.column.aggregation,
    currField: this.props.column.field,
    currName: this.props.column.name,
    aggregations: filterAggregationByField(this.props.column.field),
    fields: filterFieldByAggregation(this.props.column.aggregation),
  };

  onChangeAggregation = (value: Aggregation) => {
    if (value === this.state.currAggregation) {
      return;
    }

    this.setState({
      currAggregation: value,
      fields: filterFieldByAggregation(value),
    });
  };

  onChangeField = (value: Field) => {
    if (value === this.state.currField) {
      return;
    }

    this.setState({
      currField: value,
      aggregations: filterAggregationByField(value),
    });
  };

  onChangeName = (value: string) => {
    if (value === this.state.currName) {
      return;
    }

    this.setState({
      currName: value,
    });
  };

  render() {
    return (
      <React.Fragment>
        <Form onSubmit={values => console.log('onSubmit', values)}>
          <FormRow>
            <FormRowItem style={{width: '35%'}}>
              <SelectField
                name="aggregation"
                label={t('Select')}
                placeholder="Aggregate"
                choices={this.state.aggregations}
                onChange={this.onChangeAggregation}
                value={this.state.currAggregation}
              />
            </FormRowItem>
            <FormRowItem style={{width: '65%'}}>
              <SelectField
                name="field"
                label="&nbsp;" // This sets the correct padding-top
                placeholder="Column"
                choices={this.state.fields}
                onChange={this.onChangeField}
                value={this.state.currField}
              />
            </FormRowItem>
          </FormRow>
          <TextField
            name="name"
            label={t('Display Name')}
            placeholder="Column Name"
            onChange={this.onChangeName}
            value={this.state.currName}
          />
        </Form>

        {/* {data && data.column ? (
          <React.Fragment>
            <Button priority="primary">Update</Button>
            <Button>Delete</Button>
          </React.Fragment>
        ) : (
          <Button priority="primary">Create</Button>
        )} */}
      </React.Fragment>
    );
  }
}

function renderModalBody(column?: TableColumn<React.ReactText>): React.ReactNode {
  return (
    <ModalEditColumnForm
      column={column}
      actions={
        {
          createColumn: () => {},
          updateColumn: () => {},
        } as any
      }
    />
  );
}

function renderModalFooter(): React.ReactNode {
  // todo(leedongwei): Check with Mimi to get the link for DiscoverV2 docs
  return (
    <FooterContent href="https://docs.sentry.io/">
      <div>
        <InlineSvg src="icon-docs" /> Discover Documentation
      </div>
      <div>
        <InlineSvg src="icon-chevron-right" />
      </div>
    </FooterContent>
  );
}

export default {
  renderModalBody,
  renderModalFooter,
};

function filterAggregationByField(f?: Field): Aggregation[] {
  if (!f || !FIELDS[f]) {
    return Object.keys(AGGREGATIONS) as Aggregation[];
  }

  return Object.keys(AGGREGATIONS).reduce(
    (accumulator, a) => {
      if (AGGREGATIONS[a] && FIELDS[f] && AGGREGATIONS[a].type === FIELDS[f]) {
        accumulator.push(a as Aggregation);
      }

      return accumulator;
    },
    [] as Aggregation[]
  );
}

function filterFieldByAggregation(a?: Aggregation): Field[] {
  if (!a || !AGGREGATIONS[a]) {
    return Object.keys(FIELDS) as Field[];
  }

  return Object.keys(FIELDS).reduce(
    (accumulator, f) => {
      if (FIELDS[f] && FIELDS[f] === AGGREGATIONS[a].type) {
        accumulator.push(f as Field);
      }

      return accumulator;
    },
    [] as Field[]
  );
}

const FormRow = styled.div`
  box-sizing: border-box;
`;
const FormRowItem = styled.div`
  display: inline-block;
  padding-right: ${space(1)};

  &:last-child {
    padding-right: 0;
  }
`;

const FooterContent = styled.a`
  display: flex;
  width: 100%;

  > div {
    display: flex;
    align-items: center;
  }

  > div:first-child {
    flex-grow: 1;

    svg {
      margin-right: 10px;
    }
  }
  > div:last-child {
    flex-grow: 0;
  }
`;
