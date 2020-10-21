import { Component } from 'react';

import {Actor} from 'app/types';
import ActorAvatar from 'app/components/avatar/actorAvatar';

type Value = {
  actor: Actor;
};

type Props = {
  value: Value;
  onRemove: (value: Value) => void;
};

export default class ValueComponent extends Component<Props> {
  handleClick = () => {
    this.props.onRemove(this.props.value);
  };

  render() {
    return (
      <a onClick={this.handleClick}>
        <ActorAvatar actor={this.props.value.actor} size={28} />
      </a>
    );
  }
}
