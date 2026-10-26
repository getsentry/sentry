import type {ReactNode} from 'react';
import * as Sentry from '@sentry/react';
import type {z} from 'zod';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {NODE_ENV} from 'sentry/constants/env';
import {t} from 'sentry/locale';

import {describeInvalidEmbed} from './invalidEmbedReport';
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

function reportInvalidEmbed({
  name,
  level,
  schema,
  data,
  issues,
}: {
  data: unknown;
  issues: readonly z.core.$ZodIssue[];
  level: SeerEmbedProps['level'];
  name: string;
  schema: z.ZodType;
}) {
  const report = describeInvalidEmbed(name, schema, data, issues);

  if (NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(report.title, report);
    return;
  }

  const key = report.fingerprint.join('|');
  if (reportedInvalidEmbeds.has(key)) {
    return;
  }
  reportedInvalidEmbeds.add(key);

  Sentry.withScope(scope => {
    scope.setLevel('warning');
    scope.setTag('seer_embed.name', name);
    scope.setTag('seer_embed.level', level);
    scope.setTag('seer_embed.invalid_fields', report.invalidFields);
    scope.setContext('seer_embed', {
      failures: report.failures,
      likely_renames: report.likelyRenames,
      unexpected_keys: report.unexpectedKeys,
      received_keys: report.receivedKeys,
    });
    scope.setFingerprint(report.fingerprint);
    Sentry.captureException(new Error(report.title));
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
      reportInvalidEmbed({name, level, schema, data, issues: parsed.error.issues});
      return null;
    }
    const parsedData = parsed.data as EmbedOutput<N>;
    return (
      // One boundary per embed, so a throw inside a single widget costs the
      // reader that widget rather than the whole message around it. Every
      // level is wrapped: the markdown pass renders as a real subtree (through
      // a portal, in `useSeerMarkdownText`), so a throw there escapes into the
      // surface that copies the reply.
      <ErrorBoundary
        mini
        message={t('Unable to render')}
        // Only a block embed can afford the alert. Inline sits inside a
        // sentence, and the markdown pass is read back as text for the
        // clipboard -- either would paste error prose into the user's reply --
        // so both degrade to nothing. Dropping one embed's text from a copy is
        // quieter than inventing words the reply never had, and there is no
        // field to fall back to that every embed shares: the schemas disagree
        // (`value`, `href`, `id`, `version`), and some of them hold DSNs and
        // raw queries that have no business appearing mid-paragraph.
        customComponent={level === 'block' ? undefined : null}
      >
        <SeerEmbedContent data={parsedData} level={level} render={render} />
      </ErrorBoundary>
    );
  }
  Embed.displayName = name;

  return Embed;
}
