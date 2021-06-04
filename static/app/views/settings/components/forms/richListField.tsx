import * as React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Button from 'app/components/button';
import ConfirmDelete from 'app/components/confirmDelete';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import {Item as ListItem} from 'app/components/dropdownAutoComplete/types';
import DropdownButton from 'app/components/dropdownButton';
import Tooltip from 'app/components/tooltip';
import {IconAdd, IconDelete, IconSettings, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import InputField from 'app/views/settings/components/forms/inputField';

type ConfirmDeleteProps = Partial<React.ComponentProps<typeof ConfirmDelete>>;
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
   * Properties for the confirm delete dialog. If missing, the item will be
   * removed immediately.
   */
  removeConfirm?: ConfirmDeleteProps;

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
    if (!this.props.disabled) {
      this.props.onEditItem?.(omit(item, 'error') as ListItem, data =>
        this.updateItem(data, index)
      );
    }
  };

  onRemoveItem = (item: ListItem, index: number) => {
    if (!this.props.disabled) {
      this.props.onRemoveItem?.(item, () => this.removeItem(index));
    }
  };

  renderItem = (item: ListItem, index: number) => {
    const {disabled, renderItem, onEditItem} = this.props;

    const error = item.error;
    const warning = item.warning;

    return (
      <Item
        disabled={!!disabled}
        key={index}
        onClick={
          error && onEditItem && !disabled
            ? () => this.onEditItem(item, index)
            : undefined
        }
      >
        {renderItem(item)}
        {error ? (
          <StatusIcon>
            <Tooltip title={error} containerDisplayMode="inline-flex">
              <IconWarning color="red300" />
            </Tooltip>
          </StatusIcon>
        ) : warning ? (
          <StatusIcon>
            <Tooltip title={warning} containerDisplayMode="inline-flex">
              <IconWarning color="yellow300" />
            </Tooltip>
          </StatusIcon>
        ) : (
          onEditItem && (
            <SettingsButton
              onClick={() => this.onEditItem(item, index)}
              disabled={disabled}
              icon={<IconSettings />}
              size="zero"
              label={t('Edit Item')}
              borderless
            />
          )
        )}
        <DeleteButtonWrapper
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {this.props.removeConfirm ? (
            <ConfirmDelete
              confirmText={t('Remove')}
              disabled={disabled}
              {...this.props.removeConfirm}
              confirmInput={item.name}
              priority="danger"
              onConfirm={() => this.onRemoveItem(item, index)}
            >
              <DeleteButton
                disabled={disabled}
                size="zero"
                icon={<IconDelete size="xs" />}
                label={t('Delete Item')}
                borderless
              />
            </ConfirmDelete>
          ) : (
            <DeleteButton
              disabled={disabled}
              size="zero"
              icon={<IconDelete size="xs" />}
              label={t('Delete Item')}
              onClick={() => this.onRemoveItem(item, index)}
              borderless
            />
          )}
        </DeleteButtonWrapper>
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

const Item = styled('li')<{
  disabled: boolean;
  onClick?: (event: React.MouseEvent) => void;
}>`
  position: relative;
  display: flex;
  align-items: center;
  border-radius: ${p => p.theme.button.borderRadius};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: ${p => p.theme.fontSizeSmall};
  text-transform: none;
  margin: 0 10px 5px 0;
  white-space: nowrap;
  padding: ${space(1)} 36px ${space(1)} ${space(1.5)};
  /* match adjacent elements */
  height: 32px;
  overflow: hidden;
  background-color: ${p => p.theme.button.default.background};
  border: 1px solid ${p => p.theme.button.default.border};
  color: ${p => p.theme.button.default.color};
  opacity: ${p => (p.disabled ? 0.65 : null)};
  cursor: ${p => (p.disabled ? 'not-allowed' : p.onClick ? 'pointer' : 'default')};
`;

const ItemButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => (p.disabled ? p.theme.gray300 : p.theme.button.default.color)};
  }
`;

const SettingsButton = styled(ItemButton)`
  margin-left: 10px;
`;

const DeleteButton = styled(ItemButton)`
  height: 100%;
  width: 100%;
`;

const StatusIcon = styled('div')`
  margin-left: 10px;
  display: inline-flex;
`;

const DeleteButtonWrapper = styled('div')`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  right: 0;
  width: 36px;
  height: 100%;
`;
