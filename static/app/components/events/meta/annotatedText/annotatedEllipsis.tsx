import React from 'react';

import {Redaction} from 'sentry/components/events/meta/annotatedText/redaction';
import {
  getRemovedForSizeLimitTooltipText,
  REMOVED_SIZE_LIMIT_CONTAINER_INFO,
} from 'sentry/components/events/meta/annotatedText/utils';
import {Tooltip} from 'sentry/components/tooltip';

type Props = {
  container: keyof typeof REMOVED_SIZE_LIMIT_CONTAINER_INFO;
  metaLength: number;
  withAnnotatedText?: boolean;
};

export function AnnotatedEllipsis({
  metaLength,
  container,
  withAnnotatedText = false,
}: Props) {
  if (!withAnnotatedText) {
    return <React.Fragment>...</React.Fragment>;
  }
  return (
    <Tooltip title={getRemovedForSizeLimitTooltipText(container, metaLength)} isHoverable>
      <Redaction>...</Redaction>
    </Tooltip>
  );
}
