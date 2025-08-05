import {useCallback, useMemo} from 'react';

import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import type {TagCollection} from 'sentry/types/group';
import {type FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';
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

export function useDetectorFilterKeys(): {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
} {
  const assignedValues = useAssignedSearchValues();

  const filterKeys = useMemo(() => {
    return Object.fromEntries(
      Object.entries(DETECTOR_FILTER_KEYS).map(([key, config]) => {
        const isAssignee = key === 'assignee';

        return [
          key,
          {
            key,
            name: key,
            predefined: config.predefined,
            values: isAssignee ? assignedValues : undefined,
          },
        ];
      })
    );
  }, [assignedValues]);

  const getFieldDefinition = useCallback<FieldDefinitionGetter>((key: string) => {
    return DETECTOR_FILTER_KEYS[key]?.fieldDefinition ?? null;
  }, []);

  return {
    filterKeys,
    getFieldDefinition,
  };
}
