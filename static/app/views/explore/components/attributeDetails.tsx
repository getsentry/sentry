import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FieldKind} from 'sentry/utils/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface AttributeDetailsProps {
  column: string;
  kind: FieldKind;
  label: ReactNode;
  traceItemType: TraceItemDataset;
}

export function AttributeDetails({
  column,
  kind,
  label,
  traceItemType,
}: AttributeDetailsProps) {
  const type = traceItemTypeToType(traceItemType);
  const definition = getFieldDefinition(column, type, kind);
  const description = definition?.desc ?? t('An attribute sent with one or more events');
  return (
    <Details>
      <DetailsLabel>{label}</DetailsLabel>
      <DetailsDescription>{description}</DetailsDescription>
    </Details>
  );
}

function traceItemTypeToType(traceItemType: TraceItemDataset): 'span' | 'log' {
  if (traceItemType === TraceItemDataset.SPANS) {
    return 'span' as const;
  }

  if (traceItemType === TraceItemDataset.LOGS) {
    return 'log' as const;
  }

  throw new Error('Cannot convert unknown trace item type to type');
}

const Details = styled('div')`
  padding: ${space(0.75)} ${space(1)};
  max-width: 220px;
  font-size: ${p => p.theme.fontSize.sm};
`;

const DetailsLabel = styled('p')`
  font-weight: ${p => p.theme.fontWeight.bold};
  word-break: break-all;
  margin-bottom: ${space(1)};
`;

const DetailsDescription = styled('p')`
  margin-bottom: 0px;
`;
