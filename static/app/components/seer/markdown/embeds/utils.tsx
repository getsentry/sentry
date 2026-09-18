import type {ReactNode} from 'react';
import * as Sentry from '@sentry/react';
import type {z} from 'zod';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {NODE_ENV} from 'sentry/constants/env';
import {t} from 'sentry/locale';

import type {SeerEmbedProps} from './registry';
import {useTrackEmbedRendered} from './renderTracking';
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

/**
 * Calls the embed's own render as a child of the boundary below.
 *
 * A boundary only catches what throws while React renders its children, so the
 * render has to happen inside one -- calling it in `Embed` would throw past the
 * boundary it is being wrapped in. Declared at module scope so the child keeps
 * its identity across re-renders and the embed is not remounted per chunk.
 */
function SeerEmbedContent<N extends SeerEmbedName>({
  data,
  level,
  render,
}: {
  data: EmbedOutput<N>;
  level: SeerEmbedProps['level'];
  render: DefineSeerEmbedOptions<N>['render'];
}) {
  return render(data, level);
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

  function Embed({data, level, index}: SeerEmbedProps) {
    const parsed = schema.safeParse(data);
    // Called before the early return so the hook stays unconditional; it
    // no-ops for an embed that failed validation and renders nothing.
    //
    // Tracking dedupes per embed instance, so counting the clipboard pass would
    // let whichever pass ran first decide the recorded level.
    useTrackEmbedRendered({
      name,
      level,
      index,
      rendered: parsed.success && level !== 'markdown',
    });
    if (!parsed.success) {
      reportInvalidEmbed(name, parsed.error.issues);
      return null;
    }
    const parsedData = parsed.data as EmbedOutput<N>;
    // The clipboard pass returns text, not elements: a fallback rendered here
    // would be pasted into the copied reply.
    if (level === 'markdown') {
      return render(parsedData, level);
    }
    return (
      // One boundary per embed, so a throw inside a single widget costs the
      // reader that widget rather than the whole message around it.
      <ErrorBoundary
        mini
        message={t('Unable to render')}
        customComponent={
          // An inline embed sits inside a paragraph, where the block alert
          // would both break the sentence and nest a div inside a <p>.
          level === 'inline' ? () => <span>{t('Unable to render')}</span> : undefined
        }
      >
        <SeerEmbedContent data={parsedData} level={level} render={render} />
      </ErrorBoundary>
    );
  }
  Embed.displayName = name;

  return Embed;
}
