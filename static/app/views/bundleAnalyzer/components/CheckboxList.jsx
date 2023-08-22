import {Component} from 'react';

import s from './CheckboxList.css';
import CheckboxListItem from './CheckboxListItem';

const ALL_ITEM = Symbol('ALL_ITEM');

export default class CheckboxList extends Component {
  static ALL_ITEM = ALL_ITEM;

  constructor(props) {
    super(props);
    this.state = {
      checkedItems: props.checkedItems || props.items,
    };
  }

  componentWillReceiveProps(newProps) {
    if (newProps.items !== this.props.items) {
      if (this.isAllChecked()) {
        // Preserving `all checked` state
        this.setState({checkedItems: newProps.items});
        this.informAboutChange(newProps.items);
      } else if (this.state.checkedItems.length) {
        // Checking only items that are in the new `items` array
        const checkedItems = newProps.items.filter(item =>
          this.state.checkedItems.find(checkedItem => checkedItem.label === item.label)
        );

        this.setState({checkedItems});
        this.informAboutChange(checkedItems);
      }
    } else if (newProps.checkedItems !== this.props.checkedItems) {
      this.setState({checkedItems: newProps.checkedItems});
    }
  }

  render() {
    const {label, items, renderLabel} = this.props;

    return (
      <div className={s.container}>
        <div className={s.label}>{label}:</div>
        <div>
          <CheckboxListItem
            item={ALL_ITEM}
            checked={this.isAllChecked()}
            onChange={this.handleToggleAllCheck}
          >
            {renderLabel}
          </CheckboxListItem>
          {items.map(item => (
            <CheckboxListItem
              key={item.label}
              item={item}
              checked={this.isItemChecked(item)}
              onChange={this.handleItemCheck}
            >
              {renderLabel}
            </CheckboxListItem>
          ))}
        </div>
      </div>
    );
  }

  handleToggleAllCheck = () => {
    const checkedItems = this.isAllChecked() ? [] : this.props.items;
    this.setState({checkedItems});
    this.informAboutChange(checkedItems);
  };

  handleItemCheck = item => {
    let checkedItems;

    if (this.isItemChecked(item)) {
      checkedItems = this.state.checkedItems.filter(checkedItem => checkedItem !== item);
    } else {
      checkedItems = [...this.state.checkedItems, item];
    }

    this.setState({checkedItems});
    this.informAboutChange(checkedItems);
  };

  isItemChecked(item) {
    return this.state.checkedItems.includes(item);
  }

  isAllChecked() {
    return this.props.items.length === this.state.checkedItems.length;
  }

  informAboutChange(checkedItems) {
    setTimeout(() => this.props.onChange(checkedItems));
  }
}
