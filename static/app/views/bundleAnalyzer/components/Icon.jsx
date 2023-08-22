import {Component} from 'react';
import cls from 'classnames';

import iconArrowRight from '../assets/icon-arrow-right.svg';
import iconPin from '../assets/icon-pin.svg';

import s from './Icon.css';

const ICONS = {
  'arrow-right': {
    src: iconArrowRight,
    size: [7, 13],
  },
  pin: {
    src: iconPin,
    size: [12, 18],
  },
};

export default class Icon extends Component {
  get style() {
    const {name, size, rotate} = this.props;
    const icon = ICONS[name];

    if (!icon) {
      throw new TypeError(`Can't find "${name}" icon.`);
    }

    let [width, height] = icon.size;

    if (size) {
      const ratio = size / Math.max(width, height);
      width = Math.min(Math.ceil(width * ratio), size);
      height = Math.min(Math.ceil(height * ratio), size);
    }

    return {
      backgroundImage: `url(${icon.src})`,
      width: `${width}px`,
      height: `${height}px`,
      transform: rotate ? `rotate(${rotate}deg)` : '',
    };
  }

  render() {
    const {className} = this.props;
    return <i className={cls(s.icon, className)} style={this.style} />;
  }
}
