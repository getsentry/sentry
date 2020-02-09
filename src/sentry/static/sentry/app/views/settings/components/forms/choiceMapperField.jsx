import {Flex, Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import InputField from 'app/views/settings/components/forms/inputField';
import SelectControl from 'app/components/forms/selectControl';
import {IconAdd} from 'app/icons/iconAdd';

const selectControlShape = PropTypes.shape(SelectControl.propTypes);

export default class ChoiceMapper extends React.Component {
  static propTypes = {
    ...InputField.propTypes,
    /**
     * Text used for the 'add row' button.
     */
    addButtonText: PropTypes.node,
    /**
     * Configuration for the add item dropdown.
     */
    addDropdown: PropTypes.shape(DropdownAutoComplete.propTypes).isRequired,
    /**
     * The label to show above the row name selected from the dropdown.
     */
    mappedColumnLabel: PropTypes.node,
    /**
     * A list of column labels (headers) for the multichoice table. This should
     * have the same mapping keys as the mappedSelectors prop.
     */
    columnLabels: PropTypes.objectOf(PropTypes.node).isRequired,
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
     * If using mappedSelectors to specifically map different choice selectors
     * per item specify this as true.
     */
    perItemMapping: PropTypes.bool,
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
      addDropdown,
      mappedColumnLabel,
      columnLabels,
      mappedSelectors,
      perItemMapping,
      disabled,
      allowEmpty,
    } = props;

    const mappedKeys = Object.keys(columnLabels);
    const emptyValue = mappedKeys.reduce((a, v) => ({...a, [v]: null}), {});

    const valueIsEmpty = this.hasValue(props.value);
    const value = valueIsEmpty ? props.value : {};

    const saveChanges = nextValue => {
      onChange(nextValue, {});

      const validValues = !Object.values(nextValue)
        .map(o => Object.values(o).find(v => v === null))
        .includes(null);

      if (allowEmpty || validValues) {
        onBlur();
      }
    };

    const addRow = data => {
      saveChanges({...value, [data.value]: emptyValue});
    };

    const removeRow = itemKey => {
      //eslint-disable-next-line no-unused-vars
      const {[itemKey]: _, ...updatedValue} = value;
      saveChanges(updatedValue);
    };

    const setValue = (itemKey, fieldKey, fieldValue) => {
      saveChanges({...value, [itemKey]: {...value[itemKey], [fieldKey]: fieldValue}});
    };

    // Remove already added values from the items list
    const selectableValues = addDropdown.items.filter(
      i => !value.hasOwnProperty(i.value)
    );

    const valueMap = addDropdown.items.reduce((map, item) => {
      map[item.value] = item.label;
      return map;
    }, {});

    const dropdown = (
      <DropdownAutoComplete
        {...addDropdown}
        alignMenu={valueIsEmpty ? 'right' : 'left'}
        items={selectableValues}
        onSelect={addRow}
        disabled={disabled}
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xsmall" disabled={disabled}>
            <IconAdd size="xs" circle />
            &nbsp;{addButtonText}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the dropdown.
    if (!valueIsEmpty) {
      return <Box>{dropdown}</Box>;
    }

    return (
      <React.Fragment>
        <Flex alignItems="center">
          <LabelColumn>
            <StyledHeader>{mappedColumnLabel}</StyledHeader>
          </LabelColumn>
          {mappedKeys.map((fieldKey, i) => (
            <Flex
              key={fieldKey}
              ml={1}
              flex="1 0 0"
              alignItems="center"
              justifyContent="space-between"
            >
              <StyledHeader>{columnLabels[fieldKey]}</StyledHeader>
              {i === mappedKeys.length - 1 && dropdown}
            </Flex>
          ))}
        </Flex>
        {Object.keys(value).map(itemKey => (
          <Flex key={itemKey} alignItems="center" mt={1}>
            <LabelColumn>{valueMap[itemKey]}</LabelColumn>
            {mappedKeys.map((fieldKey, i) => (
              <Flex key={fieldKey} alignItems="center" ml={1} flex="1 0 0">
                <Box flex={1}>
                  <SelectControl
                    deprecatedSelectControl
                    {...(perItemMapping
                      ? mappedSelectors[itemKey][fieldKey]
                      : mappedSelectors[fieldKey])}
                    height={30}
                    disabled={disabled}
                    onChange={v => setValue(itemKey, fieldKey, v ? v.value : null)}
                    value={value[itemKey][fieldKey]}
                  />
                </Box>
                {i === mappedKeys.length - 1 && (
                  <Box ml={1}>
                    <Button
                      icon="icon-trash"
                      size="small"
                      disabled={disabled}
                      onClick={() => removeRow(itemKey)}
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

const LabelColumn = styled(p => <Box flex="0 0 200px" {...p} />)``;

const StyledHeader = styled(Box)`
  font-size: 0.8em;
  text-transform: uppercase;
  color: ${p => p.theme.gray3};
`;
