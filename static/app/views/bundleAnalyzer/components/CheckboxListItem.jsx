import {Component} from 'react';

import Checkbox from './Checkbox';
import CheckboxList from './CheckboxList';
import s from './CheckboxList.css';

export default class CheckboxListItem extends Component {
  renderLabel() {
    const {children, item} = this.props;

    if (children) {
      return children(item);
    }

    return item === CheckboxList.ALL_ITEM ? 'All' : item.label;
  }

  handleChange = () => {
    this.props.onChange(this.props.item);
  };

  render() {
    return (
      <div className={s.item}>
        <Checkbox {...this.props} onChange={this.handleChange}>
          {this.renderLabel()}
        </Checkbox>
      </div>
    );
  }
}
