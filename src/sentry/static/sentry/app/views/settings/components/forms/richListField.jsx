import pickBy from 'lodash/pickBy';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import {IconAdd, IconDelete, IconSettings} from 'app/icons';
import InputField from 'app/views/settings/components/forms/inputField';
import Confirm from 'app/components/confirm';

const RichListProps = {
  /**
   * Text used for the add item button.
   */
  addButtonText: PropTypes.node,

  /**
   * Configuration for the add item dropdown.
   */
  addDropdown: PropTypes.shape(DropdownAutoComplete.propTypes).isRequired,

  /**
   * Render function to render an item.
   */
  renderItem: PropTypes.func,

  /**
   * Callback invoked when an item is added via the dropdown menu.
   */
  onAddItem: PropTypes.func,

  /**
   * Callback invoked when an item is interacted with.
   */
  onEditItem: PropTypes.func,

  /**
   * Callback invoked when an item is removed.
   */
  onRemoveItem: PropTypes.func,

  /**
   * Properties for the confirm remove dialog. If missing, the item will be
   * removed immediately.
   */
  removeConfirm: PropTypes.object,
};

function getDefinedProps(propTypes, props) {
  return pickBy(props, (_prop, key) => key in propTypes);
}

class RichList extends React.PureComponent {
  static propTypes = {
    ...RichListProps,

    /**
     * Disables all controls in the rich list.
     */
    disabled: PropTypes.bool,

    /**
     * The list of items to render.
     */
    value: PropTypes.array.isRequired,
  };

  static defaultProps = {
    addButtonText: t('Add Item'),
    renderItem: item => item,
    onAddItem: (item, addItem) => addItem(item),
    onRemoveItem: (item, removeItem) => removeItem(item),
  };

  triggerChange = items => {
    if (!this.props.disabled) {
      this.props.onChange(items, {});
      this.props.onBlur(items, {});
    }
  };

  addItem = data => {
    const items = [...this.props.value, data];
    this.triggerChange(items);
  };

  updateItem = (data, index) => {
    const items = [...this.props.value];
    items.splice(index, 1, data);
    this.triggerChange(items);
  };

  removeItem = index => {
    const items = [...this.props.value];
    items.splice(index, 1);
    this.triggerChange(items);
  };

  onSelectDropdownItem = item => {
    if (!this.props.disabled) {
      this.props.onAddItem(item, this.addItem);
    }
  };

  onEditItem = (item, index) => {
    if (!this.props.disabled) {
      this.props.onEditItem(item, data => this.updateItem(data, index));
    }
  };

  onRemoveItem = (item, index) => {
    if (!this.props.disabled) {
      this.props.onRemoveItem(item, () => this.removeItem(index));
    }
  };

  renderItem = (item, index) => {
    const {disabled} = this.props;

    const removeIcon = (onClick = null) => (
      <ItemButton
        onClick={onClick}
        disabled={disabled}
        size="zero"
        icon={<IconDelete size="xs" />}
        borderless
      />
    );

    const removeConfirm =
      this.props.removeConfirm && !disabled ? (
        <Confirm
          priority="danger"
          confirmText={t('Remove')}
          {...this.props.removeConfirm}
          onConfirm={() => this.onRemoveItem(item, index)}
        >
          {removeIcon()}
        </Confirm>
      ) : (
        removeIcon(() => this.onRemoveItem(item, index))
      );

    return (
      <Item disabled={disabled} key={index}>
        {this.props.renderItem(item)}
        {this.props.onEditItem && (
          <ItemButton
            onClick={() => this.onEditItem(item, index)}
            disabled={disabled}
            icon={<IconSettings />}
            size="zero"
            borderless
          />
        )}
        {removeConfirm}
      </Item>
    );
  };

  renderDropdown = () => {
    const {disabled} = this.props;

    return (
      <DropdownAutoComplete
        {...this.props.addDropdown}
        disabled={disabled}
        alignMenu="left"
        onSelect={this.onSelectDropdownItem}
      >
        {({isOpen}) => (
          <DropdownButton
            disabled={disabled}
            icon={<IconAdd size="xs" isCircled />}
            isOpen={isOpen}
            size="small"
          >
            {this.props.addButtonText}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  };

  render() {
    return (
      <ItemList>
        {this.props.value.map(this.renderItem)}
        {this.renderDropdown()}
      </ItemList>
    );
  }
}

export default class RichListField extends React.PureComponent {
  static propTypes = {
    ...InputField.propTypes,
    ...RichListProps,
  };

  renderRichList = fieldProps => {
    const richListProps = getDefinedProps(RichListProps, this.props);
    const {value, ...props} = fieldProps;

    // We must not render this field until `setValue` has been applied by the
    // model, which is done after the field is mounted for the first time. To
    // check this, we cannot use Array.isArray because the value passed in by
    // the model might actually be an ObservableArray.
    if (typeof value === 'string' || value.length === undefined) {
      return null;
    }

    return <RichList {...props} value={[...value]} {...richListProps} />;
  };

  render() {
    return <InputField {...this.props} field={this.renderRichList} />;
  }
}

const ItemList = styled('ul')`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 0;
`;

const Item = styled('li')`
  display: flex;
  align-items: center;
  background-color: ${p => p.theme.button.default.background};
  border: 1px solid ${p => p.theme.button.default.border};
  border-radius: ${p => p.theme.button.borderRadius};
  color: ${p => p.theme.button.default.color};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'default')};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: ${p => p.theme.fontSizeSmall};
  text-transform: none;
  margin: 0 10px 5px 0;
  white-space: nowrap;
  opacity: ${p => (p.disabled ? 0.65 : null)};
  padding: 8px 12px;
  /* match adjacent elements */
  height: 30px;
`;

const ItemButton = styled(Button)`
  margin-left: 10px;
  color: ${p => p.theme.gray500};
  &:hover {
    color: ${p => (p.disabled ? p.theme.gray500 : p.theme.button.default.color)};
  }
`;
