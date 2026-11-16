import {downloadFromHref} from 'sentry/utils/downloadFromHref';

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], {type: `${mimeType};charset=utf-8`});
  const href = URL.createObjectURL(blob);
  downloadFromHref(filename, href);
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildExportFilename(
  title: string | null,
  conversationId: string,
  extension: string
): string {
  const base = (title && slugify(title)) || `conversation-${slugify(conversationId)}`;
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${extension}`;
}
