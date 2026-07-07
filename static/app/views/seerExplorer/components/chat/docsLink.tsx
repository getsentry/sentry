import {ExternalLink} from '@sentry/scraps/link';

import {
  SeerComponentRegistry,
  type SeerEmbedProps,
} from 'sentry/views/seerExplorer/components/chat/seerComponentRegistry';

const DOCS_HOSTNAME = 'docs.sentry.io';

interface DocsLinkProps {
  title: string;
  url: string;
}

export function DocsLink({url, title}: DocsLinkProps) {
  return <ExternalLink href={url}>{title}</ExternalLink>;
}

// Seer emits `{% docs-link %}{"url": ..., "title": ...}{% /docs-link %}`; the url/title
// live on the JSON body (`data`) but we also accept opening-tag attrs as a fallback.
function parseDocsLink(
  attrs: Record<string, string>,
  data: unknown
): DocsLinkProps | null {
  const source =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : attrs;
  const url = typeof source.url === 'string' ? source.url : undefined;
  const title = typeof source.title === 'string' ? source.title : undefined;
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== DOCS_HOSTNAME) {
    return null;
  }
  return {url, title: title || url};
}

function DocsLinkEmbed({attrs, data}: SeerEmbedProps) {
  const props = parseDocsLink(attrs, data);
  return props ? <DocsLink {...props} /> : null;
}

SeerComponentRegistry.register('docs-link', DocsLinkEmbed, {
  attrs: {},
  data: {url: 'https://docs.sentry.io/product/issues/', title: 'Issues'},
  level: 'inline',
});
