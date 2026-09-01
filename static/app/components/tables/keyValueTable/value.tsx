import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {StructuredData, StructuredEventData} from 'sentry/components/structuredEventData';
import type {KeyValueListDataItem} from 'sentry/types/group';

export interface ValueProps {
  value: KeyValueListDataItem['value'];
  /**
   * Renders the raw value instead of structured data.
   */
  disableFormattedData?: boolean;
  /**
   * Renders the value with the expandable structured event data viewer.
   */
  isContextData?: boolean;
  meta?: Record<string, any>;
  /**
   * Stringifies the value before handing it to the structured event data viewer.
   */
  raw?: boolean;
  subjectIcon?: React.ReactNode;
}

export function Value({
  value,
  meta,
  subjectIcon,
  isContextData = false,
  raw = false,
  disableFormattedData = false,
}: ValueProps) {
  if (isContextData) {
    return (
      <StructuredEventData
        data={raw ? JSON.stringify(value) : value}
        meta={meta}
        withAnnotatedText
      >
        {subjectIcon}
      </StructuredEventData>
    );
  }

  if (disableFormattedData) {
    if (isValidElement(value)) {
      return <Fragment>{value}</Fragment>;
    }

    return <AnnotatedText value={value as string} meta={meta} />;
  }

  return (
    <StructuredData
      value={value}
      maxDefaultDepth={0}
      meta={meta}
      withAnnotatedText
      withOnlyFormattedText
    />
  );
}

/**
 * The `list` variant predates structured data and leans on `<pre>` for values,
 * which the legacy `table.key-value` stylesheet still targets.
 */
export function PreformattedValue({
  value,
  meta,
  subjectIcon,
  isContextData = false,
  raw = false,
}: ValueProps) {
  if (isContextData) {
    return (
      <Value
        value={value}
        meta={meta}
        subjectIcon={subjectIcon}
        isContextData
        raw={raw}
      />
    );
  }

  const dataValue =
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

export const ValueLink = styled(Link)`
  text-decoration: ${p => p.theme.tokens.interactive.link.accent.rest} underline dotted;
`;
