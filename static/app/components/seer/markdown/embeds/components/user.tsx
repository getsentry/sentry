import {Avatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
function ActorBadge({id, type, name}: EmbedOutput<'user'>) {
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
      <Avatar
        type="letter_avatar"
        identifier={id}
        name={name}
        size={16}
        round={type === 'user'}
      />
      <Text as="span">{title}</Text>
    </Flex>
  );
}

export const User = defineSeerEmbed({
  name: 'user',
  render({id, type, name}) {
    return <ActorBadge id={id} type={type} name={name} />;
  },
});

export const Actor = defineSeerEmbed({
  name: 'actor',
  render({id, type, name}) {
    return <ActorBadge id={id} type={type} name={name} />;
  },
});
