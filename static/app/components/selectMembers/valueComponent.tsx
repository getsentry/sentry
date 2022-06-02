import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Actor} from 'sentry/types';

type Value = {
  actor: Actor;
};

type Props = {
  onRemove: (value: Value) => void;
  value: Value;
};

function ValueComponent({value, onRemove}: Props) {
  return (
    <a onClick={() => onRemove(value)}>
      <ActorAvatar actor={value.actor} size={28} />
    </a>
  );
}

export default ValueComponent;
