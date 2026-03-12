import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import ClippedBox from 'sentry/components/clippedBox';
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
  const rows = useMemo(() => (data ? Object.keys(data).sort() : []), [data]);

  if (!data) {
    return null;
  }

  return (
    <StyledClippedBox clipHeight={350} data-test-id="core-stacktrace-frame-vars">
      <VariablesGrid>
        {rows.map(rawKey => (
          <VariableRow key={rawKey}>
            <VariableKey>
              <Text as="div" size="sm" monospace bold>
                {formatVariableKey(rawKey)}
              </Text>
            </VariableKey>
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
          </VariableRow>
        ))}
      </VariablesGrid>
    </StyledClippedBox>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const VariablesGrid = styled('div')`
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: baseline;
`;

const VariableRow = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
  column-gap: ${p => p.theme.space.md};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const VariableKey = styled('div')`
  overflow-wrap: anywhere;
  padding: ${p => p.theme.space.md} 0 ${p => p.theme.space.md} ${p => p.theme.space.md};
`;

const VariablesValue = styled('div')`
  min-width: 0;
  align-self: stretch;
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.md};

  > pre {
    margin: 0;
    padding: 0;
    background: transparent;
  }
`;
