import {useMemo} from 'react';
import sortBy from 'lodash/sortBy';

import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {StructedEventDataConfig} from 'sentry/components/structuredEventData';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import type {PlatformKey} from 'sentry/types/platform';

type Props = {
  data: Record<
    string,
    string | null | boolean | number | Record<string, string | null>
  > | null;
  meta?: Record<any, any>;
  platform?: PlatformKey;
};

const PYTHON_STRING_REGEX = /^['"](.*)['"]$/;
const NUMERIC_STRING_REGEX = /^-?\d+(\.\d+)?$/;

const renderPythonBoolean = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  return value ? 'True' : 'False';
};

const renderNodeNull = (value: unknown) => {
  if (value === '<null>') {
    return 'null';
  }

  if (value === '<undefined>') {
    return 'undefined';
  }

  return String(value);
};

const getStructuredDataConfig = ({
  platform,
}: {
  platform?: PlatformKey;
}): StructedEventDataConfig => {
  switch (platform) {
    case 'python':
      return {
        isBoolean: value =>
          typeof value === 'boolean' || value === 'True' || value === 'False',
        isNull: value => value === null || value === 'None',
        renderBoolean: renderPythonBoolean,
        renderNull: () => 'None',
        // Python SDK wraps string values in single quotes
        isString: value => typeof value === 'string' && PYTHON_STRING_REGEX.test(value),
        // Strip single quotes from python strings for display purposes
        renderString: value => value.replace(PYTHON_STRING_REGEX, '$1'),
        // Python SDK returns numbers as strings, but we can assume they are numbers if they look like one
        isNumber: value =>
          typeof value === 'number' ||
          (typeof value === 'string' && NUMERIC_STRING_REGEX.test(value)),
      };
    case 'ruby':
      return {
        isBoolean: value =>
          typeof value === 'boolean' || value === 'true' || value === 'false',
        isNull: value => value === null || value === 'nil',
        renderNull: () => 'nil',
      };
    case 'php':
      return {
        isBoolean: value =>
          typeof value === 'boolean' || value === 'true' || value === 'false',
        isNull: value => value === null || value === 'null',
      };
    case 'node':
      return {
        isNull: value => value === null || value === '<null>' || value === '<undefined>',
        renderNull: renderNodeNull,
      };
    default:
      return {};
  }
};

export function FrameVariables({data, meta, platform}: Props) {
  const keys = useMemo(
    () => (data ? sortBy(Object.keys(data).reverse(), key => key.toLowerCase()) : []),
    [data]
  );

  if (!data || keys.length === 0) {
    return null;
  }

  const config = getStructuredDataConfig({platform});

  return (
    <Grid columns="175px minmax(0, 1fr)" gap="md" role="table" width="100%">
      {keys.map(key => (
        <Grid
          key={key}
          align="start"
          borderTop="primary"
          column="1 / -1"
          columns="subgrid"
          gap="md lg"
          padding="md xl"
          role="row"
        >
          <Container padding="md 0 md xl" role="cell">
            <Text as="div" bold density="comfortable" wordBreak="break-word">
              {key}
            </Text>
          </Container>
          <Container
            minWidth="0"
            padding="md lg"
            radius="sm"
            background="secondary"
            role="cell"
          >
            <Text monospace size="sm" wordBreak="break-word" wrap="pre-wrap">
              {textProps => (
                <Container overflow="visible">
                  {layoutProps => (
                    <StructuredEventData
                      {...textProps}
                      {...layoutProps}
                      className={`${textProps.className} ${layoutProps.className}`}
                      config={config}
                      data={data[key]}
                      meta={meta?.[key]}
                      withAnnotatedText
                    />
                  )}
                </Container>
              )}
            </Text>
          </Container>
        </Grid>
      ))}
    </Grid>
  );
}
