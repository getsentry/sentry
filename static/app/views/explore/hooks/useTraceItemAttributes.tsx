import {useMemo} from 'react';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TagCollection} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DASHBOARD_ONLY_SPAN_ATTRIBUTES,
  SENTRY_LOG_BOOLEAN_TAGS,
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
  SENTRY_PREPROD_BOOLEAN_TAGS,
  SENTRY_PREPROD_NUMBER_TAGS,
  SENTRY_PREPROD_STRING_TAGS,
  SENTRY_SPAN_BOOLEAN_TAGS,
  SENTRY_SPAN_NUMBER_TAGS,
  SENTRY_SPAN_STRING_TAGS,
  SENTRY_TRACEMETRIC_BOOLEAN_TAGS,
  SENTRY_TRACEMETRIC_NUMBER_TAGS,
  SENTRY_TRACEMETRIC_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {removeHiddenKeys} from 'sentry/views/explore/utils';
import {
  selectTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

type TypedTraceItemAttributes = {
  array: TagCollection;
  arraySecondaryAliases: TagCollection;
  boolean: TagCollection;
  booleanSecondaryAliases: TagCollection;
  number: TagCollection;
  numberSecondaryAliases: TagCollection;
  string: TagCollection;
  stringSecondaryAliases: TagCollection;
};

type TypedTraceItemAttributesStatus = {
  arrayAttributesLoading: boolean;
  booleanAttributesLoading: boolean;
  numberAttributesLoading: boolean;
  stringAttributesLoading: boolean;
};

type TypedTraceItemAttributesResult = TypedTraceItemAttributes &
  TypedTraceItemAttributesStatus;

type TraceItemAttributeType = 'number' | 'string' | 'boolean' | 'array';

type TraceItemAttributeResult = {
  attributes: TagCollection;
  isLoading: boolean;
  secondaryAliases: TagCollection;
};

export type TraceItemAttributeConfig = {
  enabled: boolean;
  traceItemType: TraceItemDataset;
  projects?: Project[] | Array<string | number>;
  query?: string;
  search?: string;
  staleTime?: number;
};

type TraceItemAttributeOptions = Partial<Omit<TraceItemAttributeConfig, 'traceItemType'>>;

function isProjectArray(
  projects: Project[] | Array<string | number>
): projects is Project[] {
  return projects.length > 0 && typeof projects[0] === 'object';
}

function useTraceItemAttributeConfig({
  traceItemType,
  enabled,
  projects: rawProjects,
  search,
  query,
  staleTime,
}: TraceItemAttributeConfig): TypedTraceItemAttributesResult {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const projects = rawProjects && isProjectArray(rawProjects) ? rawProjects : undefined;
  const projectIds =
    rawProjects && !isProjectArray(rawProjects) ? rawProjects : undefined;

  const {data, isFetching: attributesLoading} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType,
      projectIds,
      projects,
      search,
      query,
      staleTime,
    }),
    enabled,
    select: selectTraceItemTagCollection(),
    placeholderData: keepPreviousData,
  });

  const allNumberAttributes = useMemo(() => {
    const measurements = getDefaultNumberAttributes(traceItemType).map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(data?.numberAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.MEASUREMENT}])
    );

    return {
      attributes: {...data?.numberAttributes, ...Object.fromEntries(measurements)},
      secondaryAliases,
    };
  }, [data?.numberAttributes, traceItemType]);

  const allStringAttributes = useMemo(() => {
    const tags = getDefaultStringAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(data?.stringAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.TAG}])
    );

    return {
      attributes: {...data?.stringAttributes, ...Object.fromEntries(tags)},
      secondaryAliases,
    };
  }, [data?.stringAttributes, traceItemType]);

  const allBooleanAttributes = useMemo(() => {
    const tags = getDefaultBooleanAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.BOOLEAN},
    ]);
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(data?.booleanAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.BOOLEAN}])
    );

    return {
      attributes: {...data?.booleanAttributes, ...Object.fromEntries(tags)},
      secondaryAliases,
    };
  }, [data?.booleanAttributes, traceItemType]);

  const allArrayAttributes = useMemo(() => {
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(data?.arrayAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.ARRAY}])
    );

    return {
      attributes: {...data?.arrayAttributes},
      secondaryAliases,
    };
  }, [data?.arrayAttributes]);

  return useMemo(
    () => ({
      boolean: allBooleanAttributes.attributes,
      number: allNumberAttributes.attributes,
      string: allStringAttributes.attributes,
      array: allArrayAttributes.attributes,
      booleanSecondaryAliases: allBooleanAttributes.secondaryAliases,
      numberSecondaryAliases: allNumberAttributes.secondaryAliases,
      stringSecondaryAliases: allStringAttributes.secondaryAliases,
      arraySecondaryAliases: allArrayAttributes.secondaryAliases,
      booleanAttributesLoading: attributesLoading,
      numberAttributesLoading: attributesLoading,
      stringAttributesLoading: attributesLoading,
      arrayAttributesLoading: attributesLoading,
    }),
    [
      allBooleanAttributes.attributes,
      allBooleanAttributes.secondaryAliases,
      allNumberAttributes.attributes,
      allNumberAttributes.secondaryAliases,
      allStringAttributes.attributes,
      allStringAttributes.secondaryAliases,
      allArrayAttributes.attributes,
      allArrayAttributes.secondaryAliases,
      attributesLoading,
    ]
  );
}

function processTraceItemAttributes(
  typedAttributesResult: TypedTraceItemAttributesResult,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
) {
  const hiddenKeySet = hiddenKeys ? new Set(hiddenKeys) : undefined;
  if (type === 'boolean') {
    return {
      attributes: hiddenKeySet
        ? removeHiddenKeys(typedAttributesResult.boolean, hiddenKeySet)
        : typedAttributesResult.boolean,
      secondaryAliases: hiddenKeySet
        ? removeHiddenKeys(typedAttributesResult.booleanSecondaryAliases, hiddenKeySet)
        : typedAttributesResult.booleanSecondaryAliases,
      isLoading: typedAttributesResult.booleanAttributesLoading,
    };
  }
  if (type === 'number') {
    return {
      attributes: hiddenKeySet
        ? removeHiddenKeys(typedAttributesResult.number, hiddenKeySet)
        : typedAttributesResult.number,
      secondaryAliases: hiddenKeySet
        ? removeHiddenKeys(typedAttributesResult.numberSecondaryAliases, hiddenKeySet)
        : typedAttributesResult.numberSecondaryAliases,
      isLoading: typedAttributesResult.numberAttributesLoading,
    };
  }

  if (type === 'array') {
    return {
      attributes: hiddenKeySet
        ? removeHiddenKeys(typedAttributesResult.array, hiddenKeySet)
        : typedAttributesResult.array,
      secondaryAliases: hiddenKeySet
        ? removeHiddenKeys(typedAttributesResult.arraySecondaryAliases, hiddenKeySet)
        : typedAttributesResult.arraySecondaryAliases,
      isLoading: typedAttributesResult.arrayAttributesLoading,
    };
  }

  return {
    attributes: hiddenKeySet
      ? removeHiddenKeys(typedAttributesResult.string, hiddenKeySet)
      : typedAttributesResult.string,
    secondaryAliases: hiddenKeySet
      ? removeHiddenKeys(typedAttributesResult.stringSecondaryAliases, hiddenKeySet)
      : typedAttributesResult.stringSecondaryAliases,
    isLoading: typedAttributesResult.stringAttributesLoading,
  };
}

export function useTraceItemAttributes(
  config: TraceItemAttributeConfig,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
): TraceItemAttributeResult {
  const typedAttributesResult = useTraceItemAttributeConfig(config);
  return processTraceItemAttributes(typedAttributesResult, type, hiddenKeys);
}

export function useTraceItemDatasetAttributes(
  traceItemType: TraceItemDataset,
  {enabled, ...rest}: TraceItemAttributeOptions = {},
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
): TraceItemAttributeResult {
  return useTraceItemAttributes(
    {
      traceItemType,
      enabled: enabled ?? true,
      ...rest,
    },
    type,
    hiddenKeys
  );
}

export function useSpanItemAttributes(
  options?: TraceItemAttributeOptions,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
): TraceItemAttributeResult {
  const mergedHiddenKeys = useMemo(() => {
    if (!hiddenKeys?.length) {
      return DASHBOARD_ONLY_SPAN_ATTRIBUTES;
    }
    return [...hiddenKeys, ...DASHBOARD_ONLY_SPAN_ATTRIBUTES];
  }, [hiddenKeys]);

  return useTraceItemDatasetAttributes(
    TraceItemDataset.SPANS,
    options,
    type,
    mergedHiddenKeys
  );
}

export function useLogItemAttributes(
  options?: TraceItemAttributeOptions,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
): TraceItemAttributeResult {
  return useTraceItemDatasetAttributes(TraceItemDataset.LOGS, options, type, hiddenKeys);
}

export function useTraceMetricItemAttributes(
  options?: TraceItemAttributeOptions,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
): TraceItemAttributeResult {
  return useTraceItemDatasetAttributes(
    TraceItemDataset.TRACEMETRICS,
    options,
    type,
    hiddenKeys
  );
}

export function usePreprodItemAttributes(
  options?: TraceItemAttributeOptions,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
): TraceItemAttributeResult {
  return useTraceItemDatasetAttributes(
    TraceItemDataset.PREPROD,
    options,
    type,
    hiddenKeys
  );
}

function getDefaultStringAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_STRING_TAGS;
  }
  if (itemType === TraceItemDataset.PREPROD) {
    return SENTRY_PREPROD_STRING_TAGS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SENTRY_TRACEMETRIC_STRING_TAGS;
  }
  return SENTRY_LOG_STRING_TAGS;
}

function getDefaultNumberAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_NUMBER_TAGS;
  }
  if (itemType === TraceItemDataset.PREPROD) {
    return SENTRY_PREPROD_NUMBER_TAGS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SENTRY_TRACEMETRIC_NUMBER_TAGS;
  }
  return SENTRY_LOG_NUMBER_TAGS;
}

function getDefaultBooleanAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_BOOLEAN_TAGS;
  }
  if (itemType === TraceItemDataset.PREPROD) {
    return SENTRY_PREPROD_BOOLEAN_TAGS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SENTRY_TRACEMETRIC_BOOLEAN_TAGS;
  }
  return SENTRY_LOG_BOOLEAN_TAGS;
}
