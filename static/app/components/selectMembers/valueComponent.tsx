import {Component} from 'react';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Actor} from 'sentry/types';

type Value = {
  actor: Actor;
};

type Props = {
  onRemove: (value: Value) => void;
  value: Value;
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
