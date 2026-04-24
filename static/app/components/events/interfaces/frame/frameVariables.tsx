import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ClippedBox} from 'sentry/components/clippedBox';
import type {StructedEventDataConfig} from 'sentry/components/structuredEventData';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

type Props = {
  data: Record<string, unknown> | null;
  meta?: Record<any, any>;
  platform?: PlatformKey;
};

const NATIVE_PLATFORMS = new Set<string>(['native', 'c', 'cocoa', 'objc', 'cocoa-swift']);

function isNativeVarMetadata(
  value: unknown
): value is Record<string, unknown> & {__type: string} {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    typeof (value as Record<string, unknown>).__type === 'string'
  );
}

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
        isString: value => typeof value === 'string' && PYTHON_STRING_REGEX.test(value),
        renderString: value => value.replace(PYTHON_STRING_REGEX, '$1'),
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

const UNAVAILABLE_STATUSES: Record<string, string> = {
  optimized_out: 'optimized out',
  memory_unavailable: 'memory unavailable',
  unresolvable_location: 'location unavailable',
  unknown_size: 'unknown type size',
};

type Annotation = {type: string; description?: string; pattern?: string};

type BadgeVariant = 'danger' | 'warning';

function getAnnotationBadge(ann: Annotation): {
  label: string;
  variant: BadgeVariant;
} {
  switch (ann.type) {
    case 'null_pointer':
      return {label: 'NULL', variant: 'danger'};
    case 'sentinel_value':
      return {label: ann.pattern ?? 'SENTINEL', variant: 'danger'};
    case 'non_canonical_address':
      return {label: 'CORRUPT', variant: 'danger'};
    case 'kernel_address':
      return {label: 'KERNEL ADDR', variant: 'warning'};
    case 'partial_overwrite':
      return {
        label: ann.pattern ? `${ann.pattern} OVERWRITE` : 'OVERWRITE',
        variant: 'danger',
      };
    default:
      return {
        label: ann.type.toUpperCase().replace(/_/g, ' '),
        variant: 'warning',
      };
  }
}

/**
 * Checks if a native var value is an expanded struct (has field keys alongside __type).
 */
function isExpandedStruct(rawValue: Record<string, unknown>): boolean {
  const nonMetaKeys = Object.keys(rawValue).filter(k => !k.startsWith('__'));
  return nonMetaKeys.length > 0 && !('__value' in rawValue) && !('__status' in rawValue);
}

/**
 * Format a struct field value for display.
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('__string_value' in obj && typeof obj.__string_value === 'string') {
      return `"${obj.__string_value}"`;
    }
    if ('__value' in obj) {
      return String(obj.__value);
    }
    return JSON.stringify(value);
  }
  return typeof value === 'string' ? value : `${value as number | boolean}`;
}

function NativeVarValue({
  rawValue,
}: {
  rawValue: Record<string, unknown> & {__type: string};
}) {
  const typeName = rawValue.__type;
  const status = rawValue.__status as string | undefined;

  // Unavailable / optimized out
  if (status && status in UNAVAILABLE_STATUSES) {
    return (
      <Text variant="muted" size="sm" italic monospace>
        {'<'}
        {UNAVAILABLE_STATUSES[status]}
        {'>'}
      </Text>
    );
  }

  // Expanded struct (has field keys alongside __type)
  if (isExpandedStruct(rawValue)) {
    const fields = Object.entries(rawValue).filter(([k]) => !k.startsWith('__'));
    return (
      <Flex direction="column" gap="2xs">
        <Text variant="muted" size="sm" monospace>
          {typeName} {'{'}
        </Text>
        {fields.map(([fieldName, fieldVal]) => (
          <Flex key={fieldName} gap="md" align="baseline" padding="0 0 0 lg">
            <Text variant="muted" size="sm" monospace>
              .{fieldName}
            </Text>
            <Text size="sm" monospace>
              {formatFieldValue(fieldVal)}
            </Text>
          </Flex>
        ))}
        <Text variant="muted" size="sm" monospace>
          {'}'}
        </Text>
      </Flex>
    );
  }

  const value = rawValue.__value;
  const stringValue = rawValue.__string_value as string | undefined;
  const annotations = rawValue.__annotations as Annotation[] | undefined;

  return (
    <Flex gap="sm" align="center" wrap="wrap">
      {stringValue ? (
        <Fragment>
          <StringValue>"{stringValue}"</StringValue>
          <Text variant="muted" size="sm" monospace>
            ({String(value)})
          </Text>
        </Fragment>
      ) : typeof value === 'number' ? (
        <Text size="sm" monospace>
          {value}
        </Text>
      ) : typeof value === 'string' && value.startsWith('0x') ? (
        <PointerValue>{value}</PointerValue>
      ) : value === undefined ? null : (
        <Text size="sm" monospace>
          {JSON.stringify(value)}
        </Text>
      )}
      {annotations?.map((ann, i) => {
        const badge = getAnnotationBadge(ann);
        return (
          <Tooltip key={i} title={ann.description ?? ann.pattern ?? ann.type}>
            <AnnotationBadge variant={badge.variant}>{badge.label}</AnnotationBadge>
          </Tooltip>
        );
      })}
    </Flex>
  );
}

type VarEntry = {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
};

export function FrameVariables({data, meta, platform}: Props) {
  const entries = useMemo<VarEntry[]>(() => {
    const config = getStructuredDataConfig({platform});
    if (!data) {
      return [];
    }

    const isNativePlatform = platform !== undefined && NATIVE_PLATFORMS.has(platform);

    if (!isNativePlatform) {
      return Object.keys(data)
        .reverse()
        .map<VarEntry>(key => ({
          key,
          label: key,
          value: (
            <StructuredEventData
              config={config}
              data={data[key]}
              meta={meta?.[key]}
              withAnnotatedText
            />
          ),
        }));
    }

    // Native: parameters first, then locals (preserve declaration order)
    const allEntries = Object.entries(data);
    const params = allEntries.filter(
      ([, v]) => isNativeVarMetadata(v) && v.__is_parameter === true
    );
    const locals = allEntries.filter(
      ([, v]) => !isNativeVarMetadata(v) || v.__is_parameter !== true
    );
    const sorted = [...params, ...locals];

    return sorted.map<VarEntry>(([key, rawValue]) => {
      if (isNativeVarMetadata(rawValue)) {
        const typeName = rawValue.__type;

        return {
          key,
          label: (
            <Fragment>
              <Text variant="muted" size="sm" monospace>
                {typeName}
              </Text>{' '}
              <Text size="sm" monospace bold>
                {key}
              </Text>
            </Fragment>
          ),
          value: <NativeVarValue rawValue={rawValue} />,
        };
      }

      return {
        key,
        label: key,
        value: (
          <StructuredEventData
            config={config}
            data={rawValue}
            meta={meta?.[key]}
            withAnnotatedText
          />
        ),
      };
    });
  }, [data, meta, platform]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <Wrapper>
      <StyledClippedBox clipHeight={250}>
        <VariablesTitle>{t('Variables')}</VariablesTitle>
        <VariablesGrid>
          {entries.map(entry => (
            <Variable key={entry.key}>
              <VarLabel>{entry.label}</VarLabel>
              <VarValue>{entry.value}</VarValue>
            </Variable>
          ))}
        </VariablesGrid>
      </StyledClippedBox>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    padding: ${p => p.theme.space.md} ${p => p.theme.space['2xl']}
      ${p => p.theme.space.xl};
  }
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;

const VariablesTitle = styled('div')`
  width: 80px;
  padding: ${p => p.theme.space.md} 0;
`;

const VariablesGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${p => p.theme.space.md};
`;

const Variable = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${p => p.theme.space.md};
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
`;

const VarLabel = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-family: ${p => p.theme.font.family.mono};
  white-space: nowrap;
`;

const VarValue = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  line-height: 1rem;
  font-size: ${p => p.theme.font.size.sm};
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StringValue = styled('span')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.colors.green400};
`;

const PointerValue = styled('span')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.colors.blue400};
`;

const AnnotationBadge = styled('span')<{variant: BadgeVariant}>`
  display: inline-block;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid;
  line-height: 1.4;
  color: ${p =>
    p.variant === 'danger' ? p.theme.colors.red400 : p.theme.colors.yellow400};
  border-color: ${p =>
    p.variant === 'danger' ? p.theme.colors.red400 : p.theme.colors.yellow400};
`;
