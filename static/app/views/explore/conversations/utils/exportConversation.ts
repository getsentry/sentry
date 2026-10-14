import {downloadFromHref} from 'sentry/utils/downloadFromHref';

/**
 * Downloads text content as a file. Uses a Blob object URL rather than a
 * `data:` URL so a full conversation transcript is not capped by browser
 * data-URL length limits.
 */
export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], {type: `${mimeType};charset=utf-8`});
  const href = URL.createObjectURL(blob);
  downloadFromHref(filename, href);
  // Revoke on the next tick so the click-triggered download has started.
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Builds a human-friendly export filename, preferring the conversation title
 * and falling back to the (opaque) id, suffixed with the date so repeat
 * exports do not overwrite one another.
 */
export function buildExportFilename(
  title: string | null,
  conversationId: string,
  extension: string
): string {
  const base = (title && slugify(title)) || `conversation-${slugify(conversationId)}`;
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${extension}`;
}
