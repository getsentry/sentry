import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import {Item as ListItem} from 'app/components/dropdownAutoComplete/types';
import DropdownButton from 'app/components/dropdownButton';
import Tooltip from 'app/components/tooltip';
import {IconAdd, IconDelete, IconSettings, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';
import InputField from 'app/views/settings/components/forms/inputField';

type ConfirmProps = Partial<React.ComponentProps<typeof Confirm>>;
type DropdownProps = Omit<React.ComponentProps<typeof DropdownAutoComplete>, 'children'>;

type UpdatedItem = ListItem | Record<string, string>;

type DefaultProps = {
  /**
   * Text used for the add item button.
   */
  addButtonText: string;

  /**
   * Callback invoked when an item is added via the dropdown menu.
   *
   * The callback is expected to call `addItem(item)`
   */
  onAddItem: RichListCallback;

  /**
   * Callback invoked when an item is removed.
   *
   * The callback is expected to call `removeItem(item)`
   */
  onRemoveItem: RichListCallback;
};

/**
 * You can get better typing by specifying the item type
 * when using this component.
 *
 * The callback parameter accepts a more general type than `ListItem` as the
 * callback handler can perform arbitrary logic and extend the payload in
 * ways that are hard to type.
 */
export type RichListCallback = (
  item: ListItem,
  callback: (item: UpdatedItem) => void
) => void;

export type RichListProps = {
  /**
   * Render function to render an item.
   */
  renderItem: (item: ListItem) => React.ReactNode;

  /**
   * The list of items to render.
   */
  value: ListItem[];

  /**
   * Configuration for the add item dropdown.
   */
  addDropdown: DropdownProps;

  /**
   * Disables all controls in the rich list.
   */
  disabled: boolean;

  onBlur?: InputField['props']['onBlur'];
  onChange?: InputField['props']['onChange'];

  /**
   * Properties for the confirm remove dialog. If missing, the item will be
   * removed immediately.
   */
  removeConfirm?: ConfirmProps;

  /**
   * Callback invoked when an item is interacted with.
   *
   * The callback is expected to call `editItem(item)`
   */
  onEditItem?: RichListCallback;
} & Partial<DefaultProps>;

class RichList extends React.PureComponent<RichListProps, {}> {
  static defaultProps: DefaultProps = {
    addButtonText: t('Add item'),
    onAddItem: (item, addItem) => addItem(item),
    onRemoveItem: (item, removeItem) => removeItem(item),
  };

  triggerChange = (items: UpdatedItem[]) => {
    if (!this.props.disabled) {
      this.props.onChange?.(items, {});
      this.props.onBlur?.(items, {});
    }
  };

  addItem = (data: UpdatedItem) => {
    const items = [...this.props.value, data];
    this.triggerChange(items);
  };

  updateItem = (data: UpdatedItem, index: number) => {
    const items = [...this.props.value] as UpdatedItem[];
    items.splice(index, 1, data);
    this.triggerChange(items);
  };

  removeItem = (index: number) => {
    const items = [...this.props.value];
    items.splice(index, 1);
    this.triggerChange(items);
  };

  onSelectDropdownItem = (item: ListItem) => {
    if (!this.props.disabled && this.props.onAddItem) {
      this.props.onAddItem(item, this.addItem);
    }
  };

  onEditItem = (item: ListItem, index: number) => {
    if (!this.props.disabled && this.props.onEditItem) {
      this.props.onEditItem(item, data => this.updateItem(data, index));
    }
  };

  onRemoveItem = (item: ListItem, index: number) => {
    if (!this.props.disabled && this.props.onRemoveItem) {
      this.props.onRemoveItem(item, () => this.removeItem(index));
    }
  };

  renderItem = (item: ListItem, index: number) => {
    const {disabled, renderItem, onEditItem} = this.props;

    const removeIcon = (onClick?: () => void) => (
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

    const error = item.error;

    return (
      <Item disabled={!!disabled} error={!!error} key={index}>
        {error && (
          <ErrorIcon>
            <Tooltip title={error}>
              <IconWarning color="red300" />
            </Tooltip>
          </ErrorIcon>
        )}
        {renderItem(item)}
        {onEditItem && (
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

/**
 * A 'rich' dropdown that provides action hooks for when item
 * are selected/created/removed.
 *
 * An example usage is the debug image selector where each 'source' option
 * requires additional configuration data.
 */
export default function RichListField(props: RichListProps & InputField['props']) {
  return (
    <InputField
      {...props}
      field={(fieldProps: RichListProps) => {
        const {value, ...otherProps} = fieldProps;

        // We must not render this field until `setValue` has been applied by the
        // model, which is done after the field is mounted for the first time. To
        // check this, we cannot use Array.isArray because the value passed in by
        // the model might actually be an ObservableArray.
        if (typeof value === 'string' || value?.length === undefined) {
          return null;
        }
        return <RichList {...otherProps} value={[...value]} />;
      }}
    />
  );
}

const ItemList = styled('ul')`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 0;
`;

const getItemStyle = (theme: Theme, disabled: boolean, error: boolean) => {
  if (disabled) {
    return `
      opacity: 0.65;
      cursor: not-allowed;
      background-color: ${theme.button.default.background};
      border: 1px solid ${theme.button.default.border};
      color: ${theme.button.default.color};
    `;
  }

  if (error) {
    return `
      color: ${theme.black};
      border: 1px solid ${theme.red300};
      &,
      button,
      button:hover,
      button:focus {
        background-color: ${theme.red100};
      }
    `;
  }

  return `
    background-color: ${theme.button.default.background};
    border: 1px solid ${theme.button.default.border};
    color: ${theme.button.default.color};
  `;
};

const Item = styled('li')<{disabled: boolean; error: boolean}>`
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
  padding: ${space(1)} ${space(1.5)};
  /* match adjacent elements */
  height: 32px;
  overflow: hidden;
  ${p => getItemStyle(p.theme, p.disabled, p.error)}
`;

const ItemButton = styled(Button)`
  margin-left: 10px;
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => (p.disabled ? p.theme.gray300 : p.theme.button.default.color)};
  }
`;

const ErrorIcon = styled('div')`
  margin-right: 10px;
  display: inline-flex;
`;
