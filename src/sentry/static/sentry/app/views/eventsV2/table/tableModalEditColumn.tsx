import React, {ReactText} from 'react';
import styled from 'react-emotion';
import {uniq} from 'lodash';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import {t} from 'app/locale';
import {Form, SelectField, TextField} from 'app/components/forms';
import InlineSvg from 'app/components/inlineSvg';
import {Organization} from 'app/types';
import space from 'app/styles/space';

import {
  AGGREGATIONS,
  FIELDS,
  TRACING_FIELDS,
  Aggregation,
  Field,
} from '../eventQueryParams';
import {TableColumn} from './types';

type ModalActions = {
  createColumn: (column: TableColumn<ReactText>, insertAt?: number) => void;
  updateColumn: (indexColumnOrder: number, column: TableColumn<ReactText>) => void;
};

export function renderTableModalEditColumnFactory(
  organization: Organization,
  tagKeys: null | string[],
  actions: ModalActions
) {
  return {
    renderModalBodyWithForm: (
      indexColumnOrder?: number,
      column?: TableColumn<ReactText>,
      onSuccessFromChild?: () => void,
      onErrorFromChild?: (error?: Error) => void
    ) => {
      return (
        <TableModalEditColumnBodyForm
          organization={organization}
          indexColumnOrder={indexColumnOrder}
          column={column}
          tagKeys={tagKeys}
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
  organization: Organization;
  indexColumnOrder?: number;
  column?: TableColumn<ReactText>;
  tagKeys: null | string[];

  actions: ModalActions & {
    onSuccess?: () => void;
    onError?: (error?: Error) => void;
  };
};
type TableModalEditColumnFormState = {
  aggregations: Aggregation[];
  fields: Field[];
  name: string;
};

class TableModalEditColumnBodyForm extends React.Component<
  TableModalEditColumnFormProps,
  TableModalEditColumnFormState
> {
  state = {
    aggregations: filterAggregationByField(
      this.props.organization,
      this.props.column ? this.props.column.field : ''
    ),
    fields: filterFieldByAggregation(
      this.props.organization,
      this.props.tagKeys,
      this.props.column ? this.props.column.aggregation : ''
    ),
    name: this.props.column ? this.props.column.name : '',
  };

  componentDidMount() {
    const {column, indexColumnOrder, organization} = this.props;

    const isEditing = !!column;
    const focusedColumnIndex =
      typeof indexColumnOrder === 'number' && indexColumnOrder >= 0
        ? indexColumnOrder
        : -1;

    if (isEditing) {
      if (typeof indexColumnOrder === 'number') {
        // metrics
        trackAnalyticsEvent({
          eventKey: 'discover_v2.edit_column.open_modal',
          eventName: 'Discoverv2: Opened modal to edit a column',
          index: focusedColumnIndex,
          organization_id: organization.id,
        });
      }
    } else {
      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.add_column.open_modal',
        eventName: 'Discoverv2: Opened modal to add a column',
        index: focusedColumnIndex,
        organization_id: organization.id,
      });
    }
  }

  onChangeAggregation = (value: Aggregation) => {
    const {organization, tagKeys} = this.props;
    this.setState({
      fields: filterFieldByAggregation(organization, tagKeys, value),
    });
  };

  onChangeField = (value: Field) => {
    const name = this.state.name === '' ? String(value) : this.state.name;
    this.setState({
      aggregations: filterAggregationByField(this.props.organization, value),
      name,
    });
  };

  onChangeName = (value: string) => {
    this.setState({name: value});
  };

  onSubmitForm = (values: any) => {
    const {indexColumnOrder, column} = this.props;
    const {createColumn, updateColumn, onSuccess, onError} = this.props.actions;
    const nextColumn: TableColumn<ReactText> = {...column, ...values};

    try {
      if (typeof indexColumnOrder === 'number' && this.props.column) {
        updateColumn(indexColumnOrder, nextColumn);
      } else {
        createColumn(nextColumn, indexColumnOrder);
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
            name: this.state.name,
          }}
        >
          <FormRow>
            <FormRowItemLeft>
              <SelectField
                name="aggregation"
                label={t('Aggregate')}
                placeholder="Select Aggregate"
                choices={this.state.aggregations}
                onChange={this.onChangeAggregation}
              />
            </FormRowItemLeft>
            <FormRowItemRight>
              <SelectField
                required
                name="field"
                label={t('Column Type')}
                placeholder="Select Column Type"
                choices={this.state.fields}
                onChange={this.onChangeField}
              />
            </FormRowItemRight>
          </FormRow>
          <FormRow>
            <TextField
              required
              name="name"
              value={this.state.name}
              label={t('Display Name')}
              placeholder="Display Name"
              onChange={this.onChangeName}
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

function filterAggregationByField(organization: Organization, f?: Field): Aggregation[] {
  let functionList = Object.keys(AGGREGATIONS);
  if (!organization.features.includes('transaction-events')) {
    functionList = functionList.filter(item => !TRACING_FIELDS.includes(item));
  }
  if (!f) {
    return functionList as Aggregation[];
  }
  // Unknown fields are likely tag keys and thus strings.
  const fieldType = FIELDS[f] || 'string';

  if (fieldType === 'never') {
    return [];
  }

  return functionList.reduce(
    (accumulator, a) => {
      if (
        AGGREGATIONS[a].type.includes(fieldType) ||
        AGGREGATIONS[a].type === '*' ||
        fieldType === '*'
      ) {
        accumulator.push(a as Aggregation);
      }

      return accumulator;
    },
    [] as Aggregation[]
  );
}

function filterFieldByAggregation(
  organization: Organization,
  tagKeys: null | string[],
  a?: Aggregation
): Field[] {
  let fieldList = Object.keys(FIELDS);
  if (tagKeys && tagKeys.length) {
    fieldList = uniq(fieldList.concat(tagKeys));
  }
  if (!organization.features.includes('transaction-events')) {
    fieldList = fieldList.filter(item => !TRACING_FIELDS.includes(item));
  }

  if (!a || !AGGREGATIONS[a]) {
    return fieldList as Field[];
  }

  return fieldList.reduce(
    (accumulator, f) => {
      // tag keys are all strings, and values not in FIELDS is a tag.
      const fieldType = FIELDS[f] || 'string';
      if (fieldType === 'never') {
        return accumulator;
      }

      if (
        AGGREGATIONS[a].type.includes(fieldType) ||
        AGGREGATIONS[a].type === '*' ||
        fieldType === '*'
      ) {
        accumulator.push(f as Field);
      }

      return accumulator;
    },
    [] as Field[]
  );
}

const FormRow = styled('div')`
  box-sizing: border-box;
`;
const FormRowItem = styled('div')`
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

const FooterContent = styled('div')`
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
