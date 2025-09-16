import {useCallback, useMemo} from 'react';

import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';
import useAssignedSearchValues from 'sentry/utils/membersAndTeams/useAssignedSearchValues';

const DETECTOR_FILTER_KEYS: Record<
  string,
  {
    fieldDefinition: FieldDefinition;
    predefined?: boolean;
  }
> = {
  name: {
    fieldDefinition: {
      desc: 'Name of the monitor',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: false,
      keywords: ['title'],
    },
  },
  type: {
    predefined: true,
    fieldDefinition: {
      desc: 'Type of the detector',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: false,
      values: ['error', 'metric', 'cron', 'uptime'],
    },
  },
  assignee: {
    predefined: true,
    fieldDefinition: {
      desc: 'User or team assigned to the monitor',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: false,
      keywords: ['assigned', 'owner'],
    },
  },
};

interface UseDetectorFilterKeysOptions {
  /**
   * Detector filter keys to exclude
   */
  excludeKeys?: string[];
}

export function useDetectorFilterKeys({excludeKeys}: UseDetectorFilterKeysOptions): {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
} {
  const assignedValues = useAssignedSearchValues();

  const filterKeys = useMemo(() => {
    const entries = Object.entries(DETECTOR_FILTER_KEYS)
      .filter(([key]) => !excludeKeys?.includes(key))
      .map(([key, config]) => [
        key,
        {
          key,
          name: key,
          predefined: config.predefined,
          values: key === 'assignee' ? assignedValues : undefined,
        },
      ]);

    return Object.fromEntries(entries);
  }, [excludeKeys, assignedValues]);

  const getFieldDefinition = useCallback<FieldDefinitionGetter>((key: string) => {
    return DETECTOR_FILTER_KEYS[key]?.fieldDefinition ?? null;
  }, []);

  return {
    filterKeys,
    getFieldDefinition,
  };
}
