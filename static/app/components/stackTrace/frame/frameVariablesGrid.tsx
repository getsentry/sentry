import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
    <Grid columns="max-content minmax(0, 1fr)" gap="xs md" align="start">
      {rows.map(rawKey => (
        <Fragment key={rawKey}>
          <Container padding="sm sm 0 sm" whiteSpace="nowrap">
            <Text as="div" size="sm" monospace bold density="comfortable">
              {formatVariableKey(rawKey)}
            </Text>
          </Container>
          <VariablesValue minWidth="0">
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
        </Fragment>
      ))}
    </Grid>
  );
}

const VariablesValue = styled(Container)`
  > * {
    margin: 0;
  }
`;
