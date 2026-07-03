import {Tag} from '@sentry/scraps/badge';

interface ToolTagProps {
  name: string;
  hasError?: boolean;
}

export function ToolTag({name, hasError}: ToolTagProps) {
  return <Tag variant={hasError ? 'danger' : 'muted'}>{name}</Tag>;
}
