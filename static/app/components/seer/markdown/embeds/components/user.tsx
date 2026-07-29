import {useMemo} from 'react';

import {ActorBadge} from 'sentry/components/idBadge/actorBadge';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import type {Actor} from 'sentry/types/core';

function Actor({id, type, name}: EmbedOutput<'user'>) {
  const actor: Actor = useMemo(() => ({id, type, name}), [id, type, name]);
  return (
    <ActorBadge
      display="inline-flex"
      style={{translate: '0 3px'}}
      actor={actor}
      avatarSize={16}
    />
  );
}

export const User = defineSeerEmbed({
  name: 'user',
  render({id, type, name}) {
    return <Actor id={id} type={type} name={name} />;
  },
});
