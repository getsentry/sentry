import type {ReactNode} from 'react';
import {Fragment, createElement, useLayoutEffect, useState} from 'react';
import {createPortal} from 'react-dom';

import {splitTags} from 'sentry/utils/marked/extensions/tag';

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
          <SeerEmbedText key={index} name={segment.name} data={segment.data} />
        )
      )}
    </Fragment>
  );
}

/** An unregistered name renders nothing, as it does in the document. */
function SeerEmbedText({name, data}: {data: unknown; name: string}) {
  const Embed = SeerEmbedRegistry.get(name);
  // `createElement` because a component read out of the registry looks to the
  // linter like one created during render.
  return Embed ? createElement(Embed, {name, data, level: 'markdown'}) : null;
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
  const [container] = useState(() => document.createElement('span'));
  const [text, setText] = useState('');

  useLayoutEffect(() => {
    // Reading a node React wrote but does not hand back is what an effect is
    // for. It cannot be derived during render: the portal's children only exist
    // once the commit that returned them has finished.
    // eslint-disable-next-line react/set-state-in-effect
    setText(container.textContent ?? '');
  }, [container, raw]);

  return {
    text,
    node: createPortal(<SeerMarkdownText raw={raw} />, container),
  };
}
