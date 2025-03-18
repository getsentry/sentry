import type React from 'react';
import {createContext, useContext, useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useSpanFieldCustomTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

import {SENTRY_SPAN_NUMBER_TAGS, SENTRY_SPAN_STRING_TAGS} from '../constants';
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
  dataset: TraceItemDataset;
  enabled: boolean;
}

export function TraceItemAttributeProvider({
  children,
  dataset,
  enabled,
}: TraceItemAttributeProviderProps) {
  const {data: indexedTags} = useSpanFieldCustomTags({
    enabled: dataset === TraceItemDataset.SPANS && enabled,
  });

  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'number',
      dataset,
    });

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'string',
      dataset,
    });

  const allNumberAttributes = useMemo(() => {
    const measurements = SENTRY_SPAN_NUMBER_TAGS.map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    return {...numberAttributes, ...Object.fromEntries(measurements)};
  }, [numberAttributes]);

  const allStringAttributes = useMemo(() => {
    const tags = SENTRY_SPAN_STRING_TAGS.map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);

    if (dataset === TraceItemDataset.SPANS) {
      return {...indexedTags, ...stringAttributes, ...Object.fromEntries(tags)};
    }

    return {...stringAttributes, ...Object.fromEntries(tags)};
  }, [dataset, indexedTags, stringAttributes]);

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
