import {useLayoutEffect, useMemo, useRef} from 'react';
import isEqual from 'lodash/isEqual';

import {
  filterInvalidGroupBys,
  filterVisibleGroupBys,
} from 'sentry/views/explore/utils/groupByValidation';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

interface UseValidatedGroupBysOptions {
  groupBys: readonly string[];
  onGroupBysCleanup: (groupBys: string[]) => void;
  validationData: EventValidationData | undefined;
  validationIsPending: boolean;
}

export function useValidatedGroupBys({
  groupBys,
  validationData,
  validationIsPending,
  onGroupBysCleanup,
}: UseValidatedGroupBysOptions) {
  const pendingValidatedGroupBys = useRef<{
    from: readonly string[];
    to: readonly string[];
  } | null>(null);
  const validationGroupBys = useRef<{
    data: EventValidationData;
    groupBys: readonly string[];
  } | null>(null);

  const validatedGroupBys = useMemo(
    () => filterInvalidGroupBys(groupBys, validationData?.field),
    [groupBys, validationData?.field]
  );
  const visibleGroupBys = useMemo(
    () => filterVisibleGroupBys(groupBys, validationData?.field, validationIsPending),
    [groupBys, validationData?.field, validationIsPending]
  );

  useLayoutEffect(() => {
    if (pendingValidatedGroupBys.current) {
      if (isEqual(groupBys, pendingValidatedGroupBys.current.to)) {
        pendingValidatedGroupBys.current = null;
      } else if (
        isEqual(groupBys, pendingValidatedGroupBys.current.from) &&
        isEqual(validatedGroupBys, pendingValidatedGroupBys.current.to)
      ) {
        return;
      }
    }

    if (validationIsPending || !validationData) {
      return;
    }

    let validationGroupBySnapshot = validationGroupBys.current;
    if (
      !validationGroupBySnapshot?.data ||
      validationGroupBySnapshot.data !== validationData
    ) {
      validationGroupBySnapshot = {
        data: validationData,
        groupBys,
      };
      validationGroupBys.current = validationGroupBySnapshot;
    }

    if (
      !isEqual(groupBys, validationGroupBySnapshot.groupBys) ||
      isEqual(groupBys, validatedGroupBys)
    ) {
      return;
    }

    pendingValidatedGroupBys.current = {
      from: groupBys,
      to: validatedGroupBys,
    };
    onGroupBysCleanup(validatedGroupBys);
  }, [
    groupBys,
    onGroupBysCleanup,
    validatedGroupBys,
    validationData,
    validationIsPending,
  ]);

  return {visibleGroupBys};
}
