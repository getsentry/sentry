import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

interface ToolTagProps {
  name: string;
  hasError?: boolean;
  /**
   * Caps the tag so long tool names ellipsize instead of overflowing their
   * container (e.g. the "+N more" overflow tooltip).
   */
  maxWidth?: number | string;
}

export function ToolTag({name, hasError, maxWidth}: ToolTagProps) {
  return (
    <Tag
      variant={hasError ? 'danger' : 'muted'}
      style={maxWidth === undefined ? undefined : {maxWidth}}
    >
      {/* Tag's internal text node is display:flex, which breaks text-overflow;
          a block-level Text ellipsizes within the max-width constraint. */}
      {maxWidth === undefined ? name : <Text ellipsis>{name}</Text>}
    </Tag>
  );
}
