import {useMemo} from 'react';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import type {Actor} from 'sentry/types/core';

function Actor({id, type, name}: EmbedOutput<'user'>) {
  const actor: Actor = useMemo(() => ({id, type, name}), [id, type, name]);
  const title = type === 'team' ? `#${name}` : name;

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
  render({id, type, name}) {
    return <Actor id={id} type={type} name={name} />;
  },
});
