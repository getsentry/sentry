import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {StructuredData} from 'sentry/components/structuredEventData';
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

export const ValueLink = styled(Link)`
  text-decoration: ${p => p.theme.tokens.interactive.link.accent.rest} underline dotted;
`;
