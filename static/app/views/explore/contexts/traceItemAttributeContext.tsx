import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {FieldKind} from 'sentry/utils/fields';
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
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {removeHiddenKeys} from 'sentry/views/explore/utils';

type TypedTraceItemAttributes = {
  boolean: TagCollection;
  booleanSecondaryAliases: TagCollection;
  number: TagCollection;
  numberSecondaryAliases: TagCollection;
  string: TagCollection;
  stringSecondaryAliases: TagCollection;
};

type TypedTraceItemAttributesStatus = {
  booleanAttributesLoading: boolean;
  numberAttributesLoading: boolean;
  stringAttributesLoading: boolean;
};

type TypedTraceItemAttributesResult = TypedTraceItemAttributes &
  TypedTraceItemAttributesStatus;

type TraceItemAttributeType = 'number' | 'string' | 'boolean';

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
}: TraceItemAttributeConfig): TypedTraceItemAttributesResult {
  const projects = rawProjects && isProjectArray(rawProjects) ? rawProjects : undefined;
  const projectIds =
    rawProjects && !isProjectArray(rawProjects) ? rawProjects : undefined;

  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'number',
      traceItemType,
      projectIds,
      projects,
      search,
      query,
    });

  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'string',
      traceItemType,
      projectIds,
      projects,
      search,
      query,
    });

  const {attributes: booleanAttributes, isLoading: booleanAttributesLoading} =
    useTraceItemAttributeKeys({
      enabled,
      type: 'boolean',
      traceItemType,
      projectIds,
      projects,
      search,
      query,
    });

  const booleanBaseKeys = useMemo(() => {
    const keys = new Set(getDefaultBooleanAttributes(traceItemType));
    for (const key of Object.keys(booleanAttributes ?? {})) {
      keys.add(extractBaseKey(key));
    }

    return keys;
  }, [booleanAttributes, traceItemType]);

  const allNumberAttributes = useMemo(() => {
    const shouldRemove = booleanBaseKeys.size > 0;
    const attributes: TagCollection = {};
    const secondaryAliases: TagCollection = {};

    for (const [key, value] of Object.entries(numberAttributes ?? {})) {
      if (!shouldRemove || !shouldRemoveAttributeKey(key, booleanBaseKeys)) {
        attributes[key] = value;
      }

      for (const alias of value.secondaryAliases ?? []) {
        if (shouldRemove && shouldRemoveAttributeKey(alias, booleanBaseKeys)) {
          continue;
        }

        secondaryAliases[alias] = {
          key: alias,
          name: alias,
          kind: FieldKind.MEASUREMENT,
        };
      }
    }

    for (const measurement of getDefaultNumberAttributes(traceItemType)) {
      if (shouldRemove && shouldRemoveAttributeKey(measurement, booleanBaseKeys)) {
        continue;
      }

      attributes[measurement] = {
        key: measurement,
        name: measurement,
        kind: FieldKind.MEASUREMENT,
      };
    }

    return {attributes, secondaryAliases};
  }, [numberAttributes, traceItemType, booleanBaseKeys]);

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

  const allBooleanAttributes = useMemo(() => {
    const tags = getDefaultBooleanAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.BOOLEAN},
    ]);
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(booleanAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.BOOLEAN}])
    );

    return {
      attributes: {...booleanAttributes, ...Object.fromEntries(tags)},
      secondaryAliases,
    };
  }, [booleanAttributes, traceItemType]);

  return useMemo(
    () => ({
      boolean: allBooleanAttributes.attributes,
      number: allNumberAttributes.attributes,
      string: allStringAttributes.attributes,
      booleanSecondaryAliases: allBooleanAttributes.secondaryAliases,
      numberSecondaryAliases: allNumberAttributes.secondaryAliases,
      stringSecondaryAliases: allStringAttributes.secondaryAliases,
      booleanAttributesLoading,
      numberAttributesLoading,
      stringAttributesLoading,
    }),
    [
      allBooleanAttributes.attributes,
      allBooleanAttributes.secondaryAliases,
      allNumberAttributes.attributes,
      allNumberAttributes.secondaryAliases,
      allStringAttributes.attributes,
      allStringAttributes.secondaryAliases,
      booleanAttributesLoading,
      numberAttributesLoading,
      stringAttributesLoading,
    ]
  );
}

function processTraceItemAttributes(
  typedAttributesResult: TypedTraceItemAttributesResult,
  type?: TraceItemAttributeType,
  hiddenKeys?: string[]
) {
  if (type === 'boolean') {
    return {
      attributes: hiddenKeys
        ? removeHiddenKeys(typedAttributesResult.boolean, hiddenKeys)
        : typedAttributesResult.boolean,
      secondaryAliases: hiddenKeys
        ? removeHiddenKeys(typedAttributesResult.booleanSecondaryAliases, hiddenKeys)
        : typedAttributesResult.booleanSecondaryAliases,
      isLoading: typedAttributesResult.booleanAttributesLoading,
    };
  }
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

const TAGS_REGEX =
  /^tags\[(?<tagKey>[\w.:-]+),(?<attributeType>boolean|number|string)\]$/;

/**
 * Extracts the base key from a tag key, handling both plain keys and
 * explicit format like `tags[key,type]`.
 */
export function extractBaseKey(key: string): string {
  const match = TAGS_REGEX.exec(key);
  if (!match?.groups) {
    return key;
  }

  return match.groups.tagKey ?? key;
}

/**
 * Returns true if an attribute key should be removed because an attribute with the same
 * base key exists.
 */
export function shouldRemoveAttributeKey(
  key: string,
  booleanBaseKeys: Set<string>
): boolean {
  return booleanBaseKeys.has(extractBaseKey(key));
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
