import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import Input from 'app/views/settings/components/forms/controls/input';
import InputField from 'app/views/settings/components/forms/inputField';
import space from 'app/styles/space';

const defaultProps = {
  addButtonText: t('Add Item'),
  allowEmpty: false,
  // Since we're saving an object, there isn't a great way to render the
  // change within the toast. Just turn off displaying the from/to portion of
  // the message.
  formatMessageValue: false,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  name?: string;
  columnLabels: object;
  columnKeys: string[];
} & DefaultProps &
  InputField['props'];

export default class TableField extends React.Component<Props> {
  static propTypes = {
    ...InputField.propTypes,
    /**
     * Text used for the 'add' button. An empty string can be used
     * to just render the "+" icon.
     */
    addButtonText: PropTypes.node,
    /**
     * An object with of column labels (headers) for the table.
     */
    columnLabels: PropTypes.object.isRequired,
    /**
     * A list of column keys for the table, in the order that you want
     * the columns to appear - order doesn't matter in columnLabels
     */
    columnKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
    /**
     * Automatically save even if fields are empty
     */
    allowEmpty: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  hasValue = value => defined(value) && !objectIsEmpty(value);

  renderField = props => {
    const {
      onChange,
      onBlur,
      addButtonText,
      columnLabels,
      columnKeys,
      disabled,
      allowEmpty,
    } = props;

    const mappedKeys = columnKeys;
    const emptyValue = mappedKeys.reduce((a, v) => ({...a, [v]: null}), {id: ''});

    const valueIsEmpty = this.hasValue(props.value);
    const value = valueIsEmpty ? props.value : [];

    const saveChanges = (nextValue: object) => {
      onChange(nextValue, []);

      const validValues = !Object.values(nextValue)
        .map(o => Object.values(o).find(v => v === null))
        .includes(null);

      if (allowEmpty || validValues) {
        onBlur();
      }
    };

    const addRow = () => {
      saveChanges([...value, emptyValue]);
    };

    const removeRow = rowIndex => {
      //eslint-disable-next-line no-unused-vars
      const newValue = [...value];
      newValue.splice(rowIndex, 1);
      saveChanges(newValue);
    };

    const setValue = (
      rowIndex: number,
      fieldKey: string,
      fieldValue: React.FormEvent<HTMLInputElement>
    ) => {
      const newValue = [...value];
      newValue[rowIndex][fieldKey] = fieldValue.currentTarget
        ? fieldValue.currentTarget.value
        : null;
      saveChanges(newValue);
    };

    const button = (
      <Button onClick={addRow} size="xsmall" disabled={disabled}>
        <StyledIconAdd size="xs" circle />
        {addButtonText}
      </Button>
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the button.
    if (!valueIsEmpty) {
      return <div>{button}</div>;
    }

    return (
      <React.Fragment>
        <HeaderContainer>
          {mappedKeys.map((fieldKey, i) => (
            <Header key={fieldKey}>
              <HeaderLabel>{columnLabels[fieldKey]}</HeaderLabel>
              {i === mappedKeys.length - 1 && button}
            </Header>
          ))}
        </HeaderContainer>
        {value.map((row, rowIndex) => (
          <RowContainer data-test-id="field-row" key={rowIndex}>
            {mappedKeys.map((fieldKey: string, i: number) => (
              <Row key={fieldKey}>
                <RowInput>
                  <Input
                    onChange={v => setValue(rowIndex, fieldKey, v ? v : null)}
                    value={!defined(row[fieldKey]) ? '' : row[fieldKey]}
                  />
                </RowInput>
                {i === mappedKeys.length - 1 && (
                  <RemoveButton>
                    <Button
                      icon="icon-trash"
                      size="small"
                      disabled={disabled}
                      onClick={() => removeRow(rowIndex)}
                    />
                  </RemoveButton>
                )}
              </Row>
            ))}
          </RowContainer>
        ))}
      </React.Fragment>
    );
  };

  render() {
    return (
      <InputField
        {...this.props}
        inline={({model}) => !this.hasValue(model.getValue(this.props.name))}
        field={this.renderField}
      />
    );
  }
}

const HeaderLabel = styled('div')`
  font-size: 0.8em;
  text-transform: uppercase;
  color: ${p => p.theme.gray3};
`;

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const Header = styled('div')`
  display: flex;
  flex: 1 0 0;
  align-items: center;
  justify-content: space-between;
`;

const RowContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1)};
`;

const Row = styled('div')`
  display: flex;
  flex: 1 0 0;
  align-items: center;
  margin-top: ${space(1)};
`;

const RowInput = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
`;

const RemoveButton = styled('div')`
  margin-left: ${space(1)};
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: ${space(0.5)};
`;
