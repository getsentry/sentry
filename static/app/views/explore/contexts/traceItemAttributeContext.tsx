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

type TypedTraceItemAttributes = {number: TagCollection; string: TagCollection};

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

    return {...numberAttributes, ...Object.fromEntries(measurements)};
  }, [numberAttributes, traceItemType]);

  const allStringAttributes = useMemo(() => {
    const tags = getDefaultStringAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);

    return {...stringAttributes, ...Object.fromEntries(tags)};
  }, [traceItemType, stringAttributes]);

  return (
    <TraceItemAttributeContext
      value={{
        number: allNumberAttributes,
        string: allStringAttributes,
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
      isLoading: typedAttributesResult.numberAttributesLoading,
    };
  }
  return {
    attributes: typedAttributesResult.string,
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
