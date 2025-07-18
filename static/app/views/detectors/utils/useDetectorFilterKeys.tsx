import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import useAssignedSearchValues from 'sentry/utils/membersAndTeams/useAssignedSearchValues';
import {DETECTOR_FILTER_KEYS} from 'sentry/views/detectors/constants';

export function useDetectorFilterKeys(): TagCollection {
  const assignedValues = useAssignedSearchValues();

  return useMemo(() => {
    return Object.fromEntries(
      Object.keys(DETECTOR_FILTER_KEYS).map(key => {
        const {values} = DETECTOR_FILTER_KEYS[key] ?? {};

        // Special handling for assignee field to provide user/team values
        if (key === 'assignee') {
          return [
            key,
            {
              key,
              name: key,
              predefined: true,
              values: assignedValues,
            },
          ];
        }

        return [
          key,
          {
            key,
            name: key,
            predefined: values !== undefined,
            values,
          },
        ];
      })
    );
  }, [assignedValues]);
}
