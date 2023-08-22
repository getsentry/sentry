import {Component} from 'react';

import Button from './Button';

export default class SwitcherItem extends Component {
  handleClick = () => {
    this.props.onClick(this.props.item);
  };

  render() {
    const {item, ...props} = this.props;
    return (
      <Button {...props} onClick={this.handleClick}>
        {item.label}
      </Button>
    );
  }
}
