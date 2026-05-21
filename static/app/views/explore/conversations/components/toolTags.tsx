import {useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

const VISIBLE_TOOL_COUNT = 5;

interface ToolTagsProps {
  toolNames: string[];
}

export function ToolTags({toolNames}: ToolTagsProps) {
  const [expanded, setExpanded] = useState(false);

  const hiddenCount = toolNames.length - VISIBLE_TOOL_COUNT;
  const displayNames = expanded ? toolNames : toolNames.slice(0, VISIBLE_TOOL_COUNT);

  return (
    <Flex direction="row" wrap="wrap" align="center" gap="sm">
      {displayNames.map(toolName => (
        <Tag key={toolName} variant="info">
          {toolName}
        </Tag>
      ))}
      {!expanded && hiddenCount > 0 && (
        <Button size="xs" variant="link" onClick={() => setExpanded(true)}>
          {t('+%s more', hiddenCount)}
        </Button>
      )}
      {expanded && (
        <Button size="xs" variant="link" onClick={() => setExpanded(false)}>
          {t('Show less')}
        </Button>
      )}
    </Flex>
  );
}
