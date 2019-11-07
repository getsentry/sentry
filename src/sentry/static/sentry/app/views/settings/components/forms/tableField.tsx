import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import InputField from 'app/views/settings/components/forms/inputField';
import Input from 'app/views/settings/components/forms/controls/input';

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
} & Partial<DefaultProps>;

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
        .includes(undefined);

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

    const setValue = (rowIndex: number, fieldKey: string, fieldValue: any) => {
      const newValue = [...value];
      console.log(fieldValue);
      newValue[rowIndex][fieldKey] =
        fieldValue && fieldValue.currentTarget ? fieldValue.currentTarget.value : null;
      saveChanges(newValue);
    };

    const button = (
      <Button icon="icon-circle-add" onClick={addRow} size="xsmall" disabled={disabled}>
        {addButtonText}
      </Button>
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the button.
    if (!valueIsEmpty) {
      return <Box>{button}</Box>;
    }

    return (
      <React.Fragment>
        <Flex align="center">
          {mappedKeys.map((fieldKey, i) => (
            <Flex
              key={fieldKey}
              ml={1}
              flex="1 0 0"
              align="center"
              justify="space-between"
            >
              <StyledHeader>{columnLabels[fieldKey]}</StyledHeader>
              {i === mappedKeys.length - 1 && button}
            </Flex>
          ))}
        </Flex>
        {value.map((row, rowIndex) => (
          <Flex key={rowIndex} align="center" mt={1}>
            {mappedKeys.map((fieldKey: string, i: number) => (
              <Flex key={fieldKey} align="center" ml={1} flex="1 0 0">
                <Box flex={1}>
                  <Input
                    onChange={v => setValue(rowIndex, fieldKey, v ? v : null)}
                    value={row[fieldKey]}
                  />
                </Box>
                {i === mappedKeys.length - 1 && (
                  <Box ml={1}>
                    <Button
                      icon="icon-trash"
                      size="small"
                      disabled={disabled}
                      onClick={() => removeRow(rowIndex)}
                    />
                  </Box>
                )}
              </Flex>
            ))}
          </Flex>
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

const StyledHeader = styled(Box)`
  font-size: 0.8em;
  text-transform: uppercase;
  color: ${p => p.theme.gray3};
`;
