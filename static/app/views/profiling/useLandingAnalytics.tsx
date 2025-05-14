import {useEffect, useMemo, useReducer, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export type DataState = 'pending' | 'loading' | 'errored' | 'empty' | 'populated';

type DataLoaded = {
  flamegraphData: DataState;
  transactionsTableData: DataState;
  widget1Data: DataState;
  widget2Data: DataState;
};

type DataStateAction = {
  dataKey: keyof DataLoaded;
  dataState: DataState;
};

function dataLoadedReducer(state: DataLoaded, action: DataStateAction) {
  return {
    ...state,
    [action.dataKey]: action.dataState,
  };
}

export function useLandingAnalytics() {
  const organization = useOrganization();

  const [dataLoaded, dispatch] = useReducer(dataLoadedReducer, {
    flamegraphData: 'pending',
    transactionsTableData: 'pending',
    widget1Data: 'pending',
    widget2Data: 'pending',
  });

  const dispatchedAnalytics = useRef(false);

  const dataState: DataState = useMemo(
    () => deriveFinalDataState(dataLoaded),
    [dataLoaded]
  );

  useEffect(() => {
    if (
      !dispatchedAnalytics.current &&
      dataState !== 'loading' &&
      dataState !== 'pending'
    ) {
      dispatchedAnalytics.current = true;
      trackAnalytics('profiling_views.landing', {
        organization,
        data: dataState,
      });
    }
  }, [dataState, organization]);

  return dispatch;
}

export function deriveFinalDataState(dataLoaded: DataLoaded): DataState {
  // if any thing on the page loads with data,
  // we consider the page populated
  if (
    dataLoaded.flamegraphData === 'populated' ||
    dataLoaded.transactionsTableData === 'populated' ||
    dataLoaded.widget1Data === 'populated' ||
    dataLoaded.widget2Data === 'populated'
  ) {
    return 'populated';
  }

  // if any thing on the page is still loading,
  // we should wait before deciding the page is empty/errored
  if (
    dataLoaded.flamegraphData === 'loading' ||
    dataLoaded.transactionsTableData === 'loading' ||
    dataLoaded.widget1Data === 'loading' ||
    dataLoaded.widget2Data === 'loading'
  ) {
    return 'loading';
  }

  // if everything on the page is still pending,
  // we should wait until something moves out of it
  // before making a decision
  if (
    dataLoaded.flamegraphData === 'pending' &&
    dataLoaded.transactionsTableData === 'pending' &&
    dataLoaded.widget1Data === 'pending' &&
    dataLoaded.widget2Data === 'pending'
  ) {
    return 'pending';
  }

  // if everything on the page errors, we consider it errored
  if (
    dataLoaded.flamegraphData === 'errored' &&
    dataLoaded.transactionsTableData === 'errored' &&
    dataLoaded.widget1Data === 'errored' &&
    dataLoaded.widget2Data === 'errored'
  ) {
    return 'errored';
  }

  return 'empty';
}
