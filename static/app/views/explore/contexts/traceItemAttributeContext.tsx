import type React from 'react';
import {createContext, useContext, useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useSpanFieldCustomTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

import {
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
  SENTRY_SPAN_NUMBER_TAGS,
  SENTRY_SPAN_STRING_TAGS,
} from '../constants';
import {useTraceItemAttributeKeys} from '../hooks/useTraceItemAttributeKeys';
import {TraceItemDataset} from '../types';

type TypedTraceItemAttributes = {number: TagCollection; string: TagCollection};

type TypedTraceItemAttributesStatus = {
  numberAttributesLoading: boolean;
  stringAttributesLoading: boolean;
};

type TypedTraceItemAttributesResult = TypedTraceItemAttributes &
  TypedTraceItemAttributesStatus;

export const TraceItemAttributeContext = createContext<
  TypedTraceItemAttributesResult | undefined
>(undefined);

interface TraceItemAttributeProviderProps {
  children: React.ReactNode;
  enabled: boolean;
  traceItemType: TraceItemDataset;
}

export function TraceItemAttributeProvider({
  children,
  traceItemType,
  enabled,
}: TraceItemAttributeProviderProps) {
  const {data: indexedTags} = useSpanFieldCustomTags({
    enabled: traceItemType === TraceItemDataset.SPANS && enabled,
  });

  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'number',
      traceItemType,
    });

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'string',
      traceItemType,
    });

  const allNumberAttributes = useMemo(() => {
    const measurements = getDefaultNumberAttributes(traceItemType).map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    return {...numberAttributes, ...Object.fromEntries(measurements)};
  }, [numberAttributes, traceItemType]);

  const allStringAttributes = useMemo(() => {
    const tags = getDefaultStringAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);

    if (traceItemType === TraceItemDataset.SPANS) {
      return {...indexedTags, ...stringAttributes, ...Object.fromEntries(tags)};
    }

    return {...stringAttributes, ...Object.fromEntries(tags)};
  }, [traceItemType, indexedTags, stringAttributes]);

  const attributesResult = useMemo(() => {
    return {
      number: allNumberAttributes,
      string: allStringAttributes,
      numberAttributesLoading,
      stringAttributesLoading,
    };
  }, [
    allNumberAttributes,
    allStringAttributes,
    numberAttributesLoading,
    stringAttributesLoading,
  ]);

  return (
    <TraceItemAttributeContext.Provider value={attributesResult}>
      {children}
    </TraceItemAttributeContext.Provider>
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
      isLoading: typedAttributesResult.numberAttributesLoading,
    };
  }
  return {
    attributes: typedAttributesResult.string,
    isLoading: typedAttributesResult.stringAttributesLoading,
  };
}

export function useTraceItemAttribute(key: string) {
  const {attributes: numberAttributes} = useTraceItemAttributes('number');
  const {attributes: stringAttributes} = useTraceItemAttributes('string');

  return stringAttributes[key] ?? numberAttributes[key] ?? null;
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
