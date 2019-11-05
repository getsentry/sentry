import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import InputField from 'app/views/settings/components/forms/inputField';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectControl from 'app/components/forms/selectControl';

const selectControlShape = PropTypes.shape(SelectControl.propTypes);

type Props = {
  name?: string;
  addButtonText?: React.ReactNode;
  DlumnLabel?: React.ReactNode;
  columnLabels: any;
  mappedSelectors?: any;
  allowEmpty?: boolean;
};

export default class TableField extends React.Component<Props> {
  static propTypes = {
    ...InputField.propTypes,
    /**
     * Text used for the 'add row' button.
     */
    addButtonText: PropTypes.node,
    /**
     * A list of column labels (headers) for the multichoice table. This should
     * have the same mapping keys as the mappedSelectors prop.
     */
    columnLabels: PropTypes.objectOf(PropTypes.node).isRequired,
    columnKeys: PropTypes.arrayOf(PropTypes.string),
    /**
     * mappedSelectors controls how the Select control should render for each
     * column. This can be generalised so that each column renders the same set
     * of choices for each mapped item by providing an object with column
     * label keys mapping to the select descriptor, OR you may specify the set
     * of select descriptors *specific* to a mapped item, where the item value
     * maps to the object of column label keys to select descriptor.
     *
     * Example - All selects are the same per column:
     *
     * {
     *   'column_key1: {...select1},
     *   'column_key2: {...select2},
     * }
     *
     * Example - Selects differ for each of the items available:
     *
     * {
     *   'my_object_value':  {'colum_key1': {...select1}, 'column_key2': {...select2}},
     *   'other_object_val': {'colum_key1': {...select3}, 'column_key2': {...select4}},
     * }
     */
    mappedSelectors: PropTypes.objectOf(
      PropTypes.oneOfType([selectControlShape, PropTypes.objectOf(selectControlShape)])
    ).isRequired,
    /**
     * Automatically save even if fields are empty
     */
    allowEmpty: PropTypes.bool,
  };

  static defaultProps = {
    addButtonText: t('Add Item'),
    perItemMapping: false,
    allowEmpty: false,
    // Since we're saving an object, there isn't a great way to render the
    // change within the toast. Just turn off displaying the from/to portion of
    // the message.
    formatMessageValue: false,
  };

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
      newValue[rowIndex][fieldKey] = fieldValue.currentTarget.value;
      saveChanges(newValue);
    };

    const button = (
      <Button icon="icon-circle-add" onClick={addRow} size="xsmall" disabled={disabled}>
        {addButtonText}
      </Button>
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the dropdown.
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
                    onChange={(v: string) => setValue(rowIndex, fieldKey, v ? v : null)}
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
