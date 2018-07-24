import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import InputField from 'app/views/settings/components/forms/inputField';
import SelectControl from 'app/components/forms/selectControl';

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
     * have the same number of items as the mappedSelectors prop.
     */
    columnLabels: PropTypes.objectOf(PropTypes.node).isRequired,
    /**
     * A list of select field properties that should be used to render the
     * select field for each column in the row.
     */
    mappedSelectors: PropTypes.objectOf(PropTypes.shape(SelectControl.propTypes))
      .isRequired,
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
      disabled,
    } = props;

    const mappedKeys = Object.keys(mappedSelectors);
    const emptyValue = mappedKeys.reduce((a, v) => ({...a, [v]: null}), {});

    const valueIsEmpty = this.hasValue(props.value);
    const value = valueIsEmpty ? props.value : {};

    const addRow = data => {
      onChange({...value, [data.value]: emptyValue}, {});
      onBlur();
    };

    const removeRow = itemKey => {
      const updatedValue = {...value};
      delete updatedValue[itemKey];
      onChange(updatedValue, {});
      onBlur();
    };

    const setValue = (itemKey, fieldKey, fieldValue) => {
      onChange({...value, [itemKey]: {...value[itemKey], [fieldKey]: fieldValue}}, {});
      onBlur();
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
          <DropdownButton
            icon="icon-circle-add"
            isOpen={isOpen}
            size="xsmall"
            disabled={disabled}
          >
            {addButtonText ? addButtonText : t('Add Item')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the dropdown.
    if (!valueIsEmpty) return <Box>{dropdown}</Box>;

    return (
      <React.Fragment>
        <Flex align="center">
          <LabelColumn>
            <StyledHeader>{mappedColumnLabel}</StyledHeader>
          </LabelColumn>
          {mappedKeys.map((k, i) => {
            const header = <StyledHeader>{columnLabels[k]}</StyledHeader>;
            const item =
              i < mappedKeys.length - 1 ? (
                header
              ) : (
                <Flex align="center" justify={'space-between'}>
                  {header}
                  {dropdown}
                </Flex>
              );

            return (
              <Box key={k} ml={1} flex="1 0 0">
                {item}
              </Box>
            );
          })}
        </Flex>
        {Object.keys(value).map(itemKey => (
          <Flex key={itemKey} align="center" mt={1}>
            <LabelColumn>{valueMap[itemKey]}</LabelColumn>
            {mappedKeys.map((fieldKey, i) => (
              <Flex key={fieldKey} align="center" ml={1} flex="1 0 0">
                <Box flex={1}>
                  <SelectControl
                    {...mappedSelectors[fieldKey]}
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
        inline={model => !this.hasValue(model.getValue(this.props.name))}
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
