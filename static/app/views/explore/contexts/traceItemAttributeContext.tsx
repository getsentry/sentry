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

interface TraceItemAttributeProviderProps {
  children: React.ReactNode;
  enabled: boolean;
  traceItemType: TraceItemDataset;
  projects?: Project[];
}

export function TraceItemAttributeProvider({
  children,
  traceItemType,
  enabled,
  projects,
}: TraceItemAttributeProviderProps) {
  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'number',
      traceItemType,
      projects,
    });

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'string',
      traceItemType,
      projects,
    });

  const allNumberAttributes = useMemo(() => {
    const measurements = getDefaultNumberAttributes(traceItemType).map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(numberAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.TAG}])
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
  }, [traceItemType, stringAttributes]);

  return (
    <TraceItemAttributeContext
      value={{
        number: allNumberAttributes.attributes,
        string: allStringAttributes.attributes,
        numberSecondaryAliases: allNumberAttributes.secondaryAliases,
        stringSecondaryAliases: allStringAttributes.secondaryAliases,
        numberAttributesLoading,
        stringAttributesLoading,
      }}
    >
      {children}
    </TraceItemAttributeContext>
  );
}

export function useTraceItemAttributes(type?: 'number' | 'string') {
  const typedAttributesResult = useContext(TraceItemAttributeContext);

  if (typedAttributesResult === undefined) {
    throw new Error(
      'useTraceItemAttributes must be used within a TraceItemAttributeProvider'
    );
  }

  if (type === 'number') {
    return {
      attributes: typedAttributesResult.number,
      secondaryAliases: typedAttributesResult.numberSecondaryAliases,
      isLoading: typedAttributesResult.numberAttributesLoading,
    };
  }
  return {
    attributes: typedAttributesResult.string,
    secondaryAliases: typedAttributesResult.stringSecondaryAliases,
    isLoading: typedAttributesResult.stringAttributesLoading,
  };
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
