import type React from 'react';
import {createContext, useContext, useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {FieldKind} from 'sentry/utils/fields';
import {
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
  SENTRY_SPAN_NUMBER_TAGS,
  SENTRY_SPAN_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {removeHiddenKeys} from 'sentry/views/explore/utils';

type TypedTraceItemAttributes = {
  number: TagCollection;
  numberSecondaryAliases: TagCollection;
  string: TagCollection;
  stringSecondaryAliases: TagCollection;
};

type TypedTraceItemAttributesStatus = {
  numberAttributesLoading: boolean;
  stringAttributesLoading: boolean;
};

type TypedTraceItemAttributesResult = TypedTraceItemAttributes &
  TypedTraceItemAttributesStatus;

const TraceItemAttributeContext = createContext<
  TypedTraceItemAttributesResult | undefined
>(undefined);

type TraceItemAttributeConfig = {
  enabled: boolean;
  traceItemType: TraceItemDataset;
  projects?: Project[];
  query?: string;
  search?: string;
};

type TraceItemAttributeProviderProps = {
  children: React.ReactNode;
} & TraceItemAttributeConfig;

export function TraceItemAttributeProvider({
  children,
  traceItemType,
  enabled,
  projects,
  search,
  query,
}: TraceItemAttributeProviderProps) {
  const typedAttributesResult = useTraceItemAttributeConfig({
    traceItemType,
    enabled,
    projects,
    search,
    query,
  });

  return (
    <TraceItemAttributeContext value={typedAttributesResult}>
      {children}
    </TraceItemAttributeContext>
  );
}

function useTraceItemAttributeConfig({
  traceItemType,
  enabled,
  projects,
  search,
  query,
}: TraceItemAttributeConfig) {
  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'number',
      traceItemType,
      projects,
      search,
      query,
    });

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'string',
      traceItemType,
      projects,
      search,
      query,
    });

  const allNumberAttributes = useMemo(() => {
    const measurements = getDefaultNumberAttributes(traceItemType).map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(numberAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.MEASUREMENT}])
    );

    return {
      attributes: {...numberAttributes, ...Object.fromEntries(measurements)},
      secondaryAliases,
    };
  }, [numberAttributes, traceItemType]);

  const allStringAttributes = useMemo(() => {
    const tags = getDefaultStringAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(stringAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.TAG}])
    );

    return {
      attributes: {...stringAttributes, ...Object.fromEntries(tags)},
      secondaryAliases,
    };
  }, [stringAttributes, traceItemType]);

  return useMemo(
    () => ({
      number: allNumberAttributes.attributes,
      string: allStringAttributes.attributes,
      numberSecondaryAliases: allNumberAttributes.secondaryAliases,
      stringSecondaryAliases: allStringAttributes.secondaryAliases,
      numberAttributesLoading,
      stringAttributesLoading,
    }),
    [
      allNumberAttributes.attributes,
      allNumberAttributes.secondaryAliases,
      allStringAttributes.attributes,
      allStringAttributes.secondaryAliases,
      numberAttributesLoading,
      stringAttributesLoading,
    ]
  );
}

function processTraceItemAttributes(
  typedAttributesResult: TypedTraceItemAttributesResult,
  type?: 'number' | 'string',
  hiddenKeys?: string[]
) {
  if (type === 'number') {
    return {
      attributes: hiddenKeys
        ? removeHiddenKeys(typedAttributesResult.number, hiddenKeys)
        : typedAttributesResult.number,
      secondaryAliases: hiddenKeys
        ? removeHiddenKeys(typedAttributesResult.numberSecondaryAliases, hiddenKeys)
        : typedAttributesResult.numberSecondaryAliases,
      isLoading: typedAttributesResult.numberAttributesLoading,
    };
  }
  return {
    attributes: hiddenKeys
      ? removeHiddenKeys(typedAttributesResult.string, hiddenKeys)
      : typedAttributesResult.string,
    secondaryAliases: hiddenKeys
      ? removeHiddenKeys(typedAttributesResult.stringSecondaryAliases, hiddenKeys)
      : typedAttributesResult.stringSecondaryAliases,
    isLoading: typedAttributesResult.stringAttributesLoading,
  };
}

export function useTraceItemAttributes(
  type?: 'number' | 'string',
  hiddenKeys?: string[]
) {
  const typedAttributesResult = useContext(TraceItemAttributeContext);

  if (typedAttributesResult === undefined) {
    throw new Error(
      'useTraceItemAttributes must be used within a TraceItemAttributeProvider'
    );
  }

  return processTraceItemAttributes(typedAttributesResult, type, hiddenKeys);
}

export function useTraceItemAttributesWithConfig(
  config: TraceItemAttributeConfig,
  type?: 'number' | 'string',
  hiddenKeys?: string[]
) {
  const typedAttributesResult = useTraceItemAttributeConfig(config);
  return processTraceItemAttributes(typedAttributesResult, type, hiddenKeys);
}

function getDefaultStringAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_STRING_TAGS;
  }
  return SENTRY_LOG_STRING_TAGS;
}

function getDefaultNumberAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_NUMBER_TAGS;
  }
  return SENTRY_LOG_NUMBER_TAGS;
}
