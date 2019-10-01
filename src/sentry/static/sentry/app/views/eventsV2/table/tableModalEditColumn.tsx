import React, {ReactText} from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {Form, SelectField, TextField} from 'app/components/forms';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

import {AGGREGATIONS, FIELDS, Aggregation, Field} from '../eventQueryParams';
import {TableColumn} from './types';

type ModalActions = {
  createColumn: (column: TableColumn<ReactText>) => void;
  updateColumn: (indexColumnOrder: number, column: TableColumn<ReactText>) => void;
};

export function renderTableModalEditColumnFactory(actions: ModalActions) {
  return {
    renderModalBodyWithForm: (
      indexColumnOrder?: number,
      column?: TableColumn<ReactText>,
      onSuccessFromChild?: () => void,
      onErrorFromChild?: (error?: Error) => void
    ) => {
      return (
        <TableModalEditColumnBodyForm
          indexColumnOrder={indexColumnOrder}
          column={column}
          actions={{
            createColumn: actions.createColumn,
            updateColumn: actions.updateColumn,
            onSuccess: onSuccessFromChild,
            onError: onErrorFromChild,
          }}
        />
      );
    },
    renderModalFooter: () => <TableModalEditColumnFooter />,
  };
}

export default renderTableModalEditColumnFactory;

type TableModalEditColumnFormProps = {
  indexColumnOrder?: number;
  column?: TableColumn<ReactText>;

  actions: ModalActions & {
    onSuccess?: () => void;
    onError?: (error?: Error) => void;
  };
};
type TableModalEditColumnFormState = {
  aggregations: Aggregation[];
  fields: Field[];
};

class TableModalEditColumnBodyForm extends React.Component<
  TableModalEditColumnFormProps,
  TableModalEditColumnFormState
> {
  state = {
    aggregations: filterAggregationByField(
      this.props.column ? this.props.column.field : ''
    ),
    fields: filterFieldByAggregation(
      this.props.column ? this.props.column.aggregation : ''
    ),
  };

  onChangeAggregation = (value: Aggregation) => {
    this.setState({
      fields: filterFieldByAggregation(value),
    });
  };

  onChangeField = (value: Field) => {
    this.setState({
      aggregations: filterAggregationByField(value),
    });
  };

  onSubmitForm = (values: any) => {
    const {indexColumnOrder, column} = this.props;
    const {createColumn, updateColumn, onSuccess, onError} = this.props.actions;
    const nextColumn: TableColumn<ReactText> = {...column, ...values};

    try {
      if (typeof indexColumnOrder === 'number' && this.props.column) {
        updateColumn(indexColumnOrder, nextColumn);
      } else {
        createColumn(nextColumn);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (e) {
      if (onError) {
        onError(e);
      }
    }
  };

  render() {
    const {column} = this.props;

    return (
      <React.Fragment>
        <Form
          onSubmit={v => this.onSubmitForm(v)}
          submitLabel={column ? t('Update column') : t('Create column')}
          initialData={{
            aggregation: column ? column.aggregation : '',
            field: column ? column.field : '',
            name: column ? column.name : '',
          }}
        >
          <FormRow>
            <FormRowItemLeft>
              <SelectField
                name="aggregation"
                label={t('Select')}
                placeholder="Aggregate"
                choices={this.state.aggregations}
                onChange={this.onChangeAggregation}
              />
            </FormRowItemLeft>
            <FormRowItemRight>
              <SelectField
                required={true}
                name="field"
                label={t('Column')}
                placeholder="Column"
                choices={this.state.fields}
                onChange={this.onChangeField}
              />
            </FormRowItemRight>
          </FormRow>
          <FormRow>
            <TextField
              required={true}
              name="name"
              label={t('Column Name')}
              placeholder="Column Name"
            />
          </FormRow>
        </Form>
      </React.Fragment>
    );
  }
}

// TODO(leedongwei): Check with Mimi to get the link for DiscoverV2 docs
const TableModalEditColumnFooter = () => (
  <FooterContent>
    {/* Attach href to documentation on FooterContent */}
    <div>
      <InlineSvg src="icon-docs" /> Documentation (Coming soon!)
    </div>
    <div>
      <InlineSvg src="icon-chevron-right" />
    </div>
  </FooterContent>
);

function filterAggregationByField(f?: Field): Aggregation[] {
  if (!f || !FIELDS[f]) {
    return Object.keys(AGGREGATIONS) as Aggregation[];
  }

  if (FIELDS[f] === 'never') {
    return [];
  }

  return Object.keys(AGGREGATIONS).reduce(
    (accumulator, a) => {
      if (
        AGGREGATIONS[a].type.includes(FIELDS[f]) ||
        AGGREGATIONS[a].type === '*' ||
        FIELDS[f] === '*'
      ) {
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
      if (!FIELDS[f] || FIELDS[f] === 'never') {
        return accumulator;
      }

      if (
        AGGREGATIONS[a].type.includes(FIELDS[f]) ||
        AGGREGATIONS[a].type === '*' ||
        FIELDS[f] === '*'
      ) {
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
const FormRowItemLeft = styled(FormRowItem)`
  width: 35%;
`;
const FormRowItemRight = styled(FormRowItem)`
  width: 65%;
`;

const FooterContent = styled.div`
  display: flex;
  width: 100%;

  /* pointer-events: none; */
  cursor: not-allowed;

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
