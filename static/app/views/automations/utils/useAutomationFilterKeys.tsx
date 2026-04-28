import {useCallback, useMemo} from 'react';

import {ItemType, type SearchGroup} from 'sentry/components/searchBar/types';
import {escapeTagValue} from 'sentry/components/searchBar/utils';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {IconStar, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';
import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';
import {useMembers} from 'sentry/utils/useMembers';
import {ActionType} from 'sentry/views/alerts/rules/metric/types';

const ACTION_TYPE_VALUES = Object.values(ActionType).sort();

const AUTOMATION_FILTER_KEYS: Record<
  string,
  {
    fieldDefinition: FieldDefinition;
    predefined?: boolean;
  }
> = {
  name: {
    fieldDefinition: {
      desc: 'Name of the Alert.',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      keywords: ['name'],
    },
  },
  action: {
    predefined: true,
    fieldDefinition: {
      desc: 'Action triggered by the Alert.',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      values: ACTION_TYPE_VALUES,
    },
  },
  created_by: {
    predefined: true,
    fieldDefinition: {
      desc: 'User who created the Alert.',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: false,
      keywords: ['creator', 'author'],
    },
  },
};

const convertToSearchItem = (value: string) => {
  const escapedValue = escapeTagValue(value);
  return {
    value: escapedValue,
    desc: value,
    type: ItemType.TAG_VALUE,
  };
};

export function useAutomationFilterKeys(): {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
} {
  const {members} = useMembers();

  const createdByValues: SearchGroup[] = useMemo(() => {
    const usernames = members.map(getUsername);

    return [
      {
        title: t('Suggested Values'),
        type: 'header',
        icon: <IconStar size="xs" />,
        children: [convertToSearchItem('me')],
      },
      {
        title: t('All Values'),
        type: 'header',
        icon: <IconUser size="xs" />,
        children: usernames.map(convertToSearchItem),
      },
    ];
  }, [members]);

  const filterKeys = useMemo(() => {
    const entries = Object.entries(AUTOMATION_FILTER_KEYS).map(([key, config]) => [
      key,
      {
        key,
        name: key,
        predefined: config.predefined,
        values: key === 'created_by' ? createdByValues : undefined,
      },
    ]);

    return Object.fromEntries(entries);
  }, [createdByValues]);

  const getFieldDefinition = useCallback<FieldDefinitionGetter>((key: string) => {
    return AUTOMATION_FILTER_KEYS[key]?.fieldDefinition ?? null;
  }, []);

  return {
    filterKeys,
    getFieldDefinition,
  };
}
