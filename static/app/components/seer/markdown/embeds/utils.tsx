import type {ReactNode} from 'react';
import * as Sentry from '@sentry/react';
import type {z} from 'zod';

import {NODE_ENV} from 'sentry/constants/env';

import type {SeerEmbedProps} from './registry';
import {ALL_SEER_EMBED_SCHEMAS, type SeerEmbedName} from './schemas';

export type EmbedOutput<N extends SeerEmbedName> = z.output<
  (typeof ALL_SEER_EMBED_SCHEMAS)[N]['schema']
>;

/**
 * Seer markdown re-lexes and re-renders on every streamed chunk, so an embed
 * with invalid props would otherwise report once per chunk. Report each
 * distinct failure only once per page load.
 */
const reportedInvalidEmbeds = new Set<string>();

function reportInvalidEmbed(name: string, issues: readonly z.core.$ZodIssue[]) {
  if (NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(`[SeerEmbed] ${name}: invalid props`, issues);
    return;
  }

  const key = `${name}:${issues.map(issue => `${issue.code}@${issue.path.join('.')}`).join('|')}`;
  if (reportedInvalidEmbeds.has(key)) {
    return;
  }
  reportedInvalidEmbeds.add(key);

  Sentry.withScope(scope => {
    scope.setLevel('warning');
    scope.setTag('seer_embed.name', name);
    scope.setExtra('issues', issues);
    scope.setFingerprint(['seer-embed-invalid-props', name]);
    Sentry.captureException(new Error(`[SeerEmbed] ${name}: invalid props`));
  });
}

interface DefineSeerEmbedOptions<N extends SeerEmbedName> {
  name: N;
  render: (props: EmbedOutput<N>, level: SeerEmbedProps['level']) => ReactNode;
}

export function defineSeerEmbed<N extends SeerEmbedName>({
  name,
  render,
}: DefineSeerEmbedOptions<N>) {
  const {schema} = ALL_SEER_EMBED_SCHEMAS[name];

  function Embed({data, level}: SeerEmbedProps) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      reportInvalidEmbed(name, parsed.error.issues);
      return null;
    }
    return render(parsed.data as EmbedOutput<N>, level);
  }
  Embed.displayName = name;

  return Embed;
}
