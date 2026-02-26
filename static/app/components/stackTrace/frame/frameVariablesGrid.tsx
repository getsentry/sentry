import {useMemo} from 'react';
import styled from '@emotion/styled';

import StructuredEventData from 'sentry/components/structuredEventData';
import type {PlatformKey} from 'sentry/types/project';

import {getStructuredDataConfig} from './getStructuredDataConfig';

const QUOTED_KEY_REGEX = /^['"](.*)['"]$/;

function formatVariableKey(key: string): string {
  return key.replace(QUOTED_KEY_REGEX, '$1');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface FrameVariablesGridProps {
  data: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
  platform?: PlatformKey;
}

export function FrameVariablesGrid({data, meta, platform}: FrameVariablesGridProps) {
  const config = useMemo(() => getStructuredDataConfig({platform}), [platform]);

  if (!data) {
    return null;
  }

  const rows = Object.keys(data).reverse();

  return (
    <VariablesGrid data-test-id="core-stacktrace-vars-grid">
      {rows.map(rawKey => (
        <VariablesRow data-test-id="core-stacktrace-vars-row" key={rawKey}>
          <VariablesKey>{formatVariableKey(rawKey)}</VariablesKey>
          <VariablesValue>
            {/*
              StructuredEventData expects record-like meta for each value; skip invalid meta entries.
            */}
            <StructuredEventData
              config={config}
              data={data[rawKey]}
              meta={isRecord(meta?.[rawKey]) ? meta[rawKey] : undefined}
              withAnnotatedText
            />
          </VariablesValue>
        </VariablesRow>
      ))}
    </VariablesGrid>
  );
}

const VariablesGrid = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: ${p => p.theme.space.md};
  row-gap: ${p => p.theme.space.xs};
  align-items: start;
`;

const VariablesRow = styled('div')`
  display: contents;
`;

const VariablesKey = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.6;
  white-space: nowrap;
  padding-left: ${p => p.theme.space.sm};
  padding-right: ${p => p.theme.space.sm};
  padding-top: ${p => p.theme.space.sm};
`;

const VariablesValue = styled('div')`
  min-width: 0;

  > * {
    margin: 0;
  }
`;
