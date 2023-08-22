import {Component} from 'react';

import s from './Switcher.css';
import SwitcherItem from './SwitcherItem';

export default class Switcher extends Component {
  render() {
    const {label, items, activeItem, onSwitch} = this.props;

    return (
      <div className={s.container}>
        <div className={s.label}>{label}:</div>
        <div>
          {items.map(item => (
            <SwitcherItem
              key={item.label}
              className={s.item}
              item={item}
              active={item === activeItem}
              onClick={onSwitch}
            />
          ))}
        </div>
      </div>
    );
  }
}
