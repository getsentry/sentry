import {useMemo} from 'react';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import type {Actor} from 'sentry/types/core';

/**
 * How the mention reads: a team is written with the `#` its name is always
 * shown with, a user by name alone.
 */
function getActorTitle({type, name}: Pick<EmbedOutput<'user'>, 'type' | 'name'>) {
  return type === 'team' ? `#${name}` : name;
}

function Actor({id, type, name}: EmbedOutput<'user'>) {
  const actor: Actor = useMemo(() => ({id, type, name}), [id, type, name]);
  const title = getActorTitle({type, name});

  // Rendered inline within Seer markdown paragraphs (`Text as="p"`), so every
  // element in this subtree must be valid phrasing content. Using `as="span"`
  // keeps the badge inline-level and avoids breaking paragraph structure.
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      gap="xs"
      style={{translate: '0 3px'}}
    >
      <ActorAvatar actor={actor} size={16} />
      <Text as="span">{title}</Text>
    </Flex>
  );
}

export const User = defineSeerEmbed({
  name: 'user',
  render({id, type, name}, level) {
    switch (level) {
      case 'markdown':
        // The avatar has no text form, and the mention was always the name.
        return getActorTitle({type, name});
      case 'block':
      case 'inline':
        return <Actor id={id} type={type} name={name} />;
    }
  },
});
