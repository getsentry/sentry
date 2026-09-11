import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {StructuredData, StructuredEventData} from 'sentry/components/structuredEventData';
import type {KeyValueListDataItem} from 'sentry/types/group';

interface ValueProps {
  value: KeyValueListDataItem['value'];
  disableFormattedData?: boolean;
  meta?: Record<string, any>;
}

export function Value({value, meta, disableFormattedData}: ValueProps) {
  if (!disableFormattedData) {
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

  if (isValidElement(value)) {
    return <Fragment>{value}</Fragment>;
  }

  return <AnnotatedText value={value as string} meta={meta} />;
}

export function ContextDataValue({
  value,
  meta,
  raw,
  subjectIcon,
}: Pick<ValueProps, 'value' | 'meta'> & {
  raw?: boolean;
  subjectIcon?: React.ReactNode;
}) {
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

export function PreformattedValue({
  value = null,
  meta,
  subjectIcon,
}: Pick<ValueProps, 'value' | 'meta'> & {subjectIcon?: React.ReactNode}) {
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
