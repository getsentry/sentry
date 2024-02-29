import {Fragment, isValidElement} from 'react';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import StructuredEventData from 'sentry/components/structuredEventData';
import type {KeyValueListData} from 'sentry/types';

export interface ValueProps
  extends Pick<KeyValueListData[0], 'subjectIcon' | 'meta' | 'value'> {
  isContextData?: boolean;
  raw?: boolean;
}

export function Value({subjectIcon, meta, raw, isContextData, value = null}: ValueProps) {
  if (isContextData) {
    return (
      <StructuredEventData
        data={!raw ? value : JSON.stringify(value)}
        meta={meta}
        withAnnotatedText
      >
        {subjectIcon}
      </StructuredEventData>
    );
  }

  const dataValue: React.ReactNode =
    typeof value === 'object' && !isValidElement(value)
      ? JSON.stringify(value, null, 2)
      : value;

  if (typeof dataValue !== 'string' && isValidElement(dataValue)) {
    return <Fragment>{dataValue}</Fragment>;
  }

  return (
    <pre className="val-string">
      <AnnotatedText value={dataValue} meta={meta} />
      {subjectIcon}
    </pre>
  );
}
