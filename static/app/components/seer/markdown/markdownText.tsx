import type {ReactNode} from 'react';
import {Fragment, createElement, useCallback, useContext, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';

import {splitTags} from '@sentry/scraps/markdown';

import {EmbedReferenceContext, useResolvedEmbed} from './embedReferences';
import {SeerEmbedRegistry} from './embeds';

/**
 * A Seer reply as text, with each embed tag replaced by what that embed
 * serializes to. Only the tags are rewritten -- the prose is already markdown,
 * and re-serializing it would flatten its headings, lists and code fences.
 */
function SeerMarkdownText({raw}: {raw: string}) {
  return (
    <Fragment>
      {splitTags(raw).map((segment, index) =>
        segment.type === 'text' ? (
          <Fragment key={index}>{segment.value}</Fragment>
        ) : (
          <SeerEmbedText
            key={index}
            name={segment.name}
            data={segment.data}
            attrs={segment.attrs}
          />
        )
      )}
    </Fragment>
  );
}

/** An unregistered name renders nothing, as it does in the document. */
function SeerEmbedText({
  name,
  data,
  attrs,
}: {
  attrs: Record<string, string>;
  data: unknown;
  name: string;
}) {
  const resolved = useResolvedEmbed({name, data, attrs});
  const Embed = resolved && SeerEmbedRegistry.get(resolved.name);
  // `createElement` because a component read out of the registry looks to the
  // linter like one created during render.
  return Embed && resolved
    ? createElement(Embed, {name: resolved.name, data: resolved.body, level: 'markdown'})
    : null;
}

interface UseSeerMarkdownTextResult {
  /** Render this for `text` to be populated. It adds nothing to the document. */
  node: ReactNode;
  /** The reply as copyable markdown. Empty until `node` has rendered. */
  text: string;
}

/**
 * Produces the text by rendering, because an embed reaches its markdown level
 * through a component and most need a hook to get there.
 *
 * The node is portalled into a detached element rather than hidden in place: a
 * hidden node is still in the document, doubling every reply's text for
 * anything reading the tree.
 */
export function useSeerMarkdownText(raw: string): UseSeerMarkdownTextResult {
  // Re-read the portal when a poll supplies records for unchanged reply text.
  const references = useContext(EmbedReferenceContext);
  const [container] = useState(() => document.createElement('span'));
  const [copy, setCopy] = useState({text: '', references});

  // Read on mount rather than from an effect. A caller can withhold the node
  // for a while -- the action bar renders nothing while a block is pending --
  // and by the time it appears `raw` is long settled, so an effect keyed on it
  // would never fire.
  const readText = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        setCopy({text: node.textContent ?? '', references});
      }
    },
    [references]
  );

  // Keyed on the reply so a new one remounts the span and re-runs the ref;
  // reconciling in place would leave the first reading behind.
  const node = useMemo(
    () =>
      createPortal(
        <span key={raw} ref={readText}>
          <SeerMarkdownText raw={raw} />
        </span>,
        container
      ),
    [container, raw, readText]
  );

  return {text: copy.references === references ? copy.text : '', node};
}
