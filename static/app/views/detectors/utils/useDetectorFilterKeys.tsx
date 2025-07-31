import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import useAssignedSearchValues from 'sentry/utils/membersAndTeams/useAssignedSearchValues';
import {DETECTOR_FILTER_KEYS} from 'sentry/views/detectors/constants';

export function useDetectorFilterKeys(): TagCollection {
  const assignedValues = useAssignedSearchValues();

  return useMemo(() => {
    return Object.fromEntries(
      Object.entries(DETECTOR_FILTER_KEYS).map(([key, config]) => {
        const {values} = config ?? {};
        const isAssignee = key === 'assignee';

        return [
          key,
          {
            key,
            name: key,
            predefined: isAssignee || values !== undefined,
            values: isAssignee ? assignedValues : values,
          },
        ];
      })
    );
  }, [assignedValues]);
}
