import type {ReactNode} from 'react';
import type {z} from 'zod';

import {NODE_ENV} from 'sentry/constants/env';

import type {SeerEmbedProps} from './registry';
import {SEER_EMBED_SCHEMAS, type SeerEmbedName} from './schemas';

type EmbedOutput<N extends SeerEmbedName> = z.output<
  (typeof SEER_EMBED_SCHEMAS)[N]['schema']
>;

interface DefineSeerEmbedOptions<N extends SeerEmbedName> {
  name: N;
  render: (props: EmbedOutput<N>) => ReactNode;
}

export function defineSeerEmbed<N extends SeerEmbedName>({
  name,
  render,
}: DefineSeerEmbedOptions<N>) {
  const {schema} = SEER_EMBED_SCHEMAS[name];

  function Embed({data}: SeerEmbedProps) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      if (NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn(`[SeerEmbed] ${name}: invalid props`, parsed.error.issues);
      }
      return null;
    }
    return render(parsed.data as EmbedOutput<N>);
  }
  Embed.displayName = name;

  return Embed;
}
