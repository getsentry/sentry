import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

interface ToolTagProps {
  name: string;
  hasError?: boolean;
  maxWidth?: number | string;
}

export function ToolTag({name, hasError, maxWidth}: ToolTagProps) {
  return (
    <Tag
      variant={hasError ? 'danger' : 'muted'}
      style={maxWidth === undefined ? undefined : {maxWidth}}
    >
      {maxWidth === undefined ? name : <Text ellipsis>{name}</Text>}
    </Tag>
  );
}
