import {Tag} from '@sentry/scraps/badge';

interface ToolTagProps {
  name: string;
  hasError?: boolean;
}

/**
 * Tool-name tag for the redesigned conversations UI. Shared by the summary
 * header, the conversations list, and the transcript's tool-call rows so they
 * stay visually consistent: muted by default, danger when the tool call errored.
 */
export function ToolTag({name, hasError}: ToolTagProps) {
  return <Tag variant={hasError ? 'danger' : 'muted'}>{name}</Tag>;
}
