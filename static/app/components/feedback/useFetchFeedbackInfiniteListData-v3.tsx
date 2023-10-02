// import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
// import {Index, IndexRange} from 'react-virtualized';
// import range from 'lodash/range';

// import {ApiResult} from 'sentry/api';
// import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
// import {
//   FeedbackItemResponse,
//   HydratedFeedbackItem,
// } from 'sentry/utils/feedback/item/types';
// import {EMPTY_QUERY_VIEW, QueryView} from 'sentry/utils/feedback/list/types';
// import {decodeInteger} from 'sentry/utils/queryString';
// import useApi from 'sentry/utils/useApi';
// import useOrganization from 'sentry/utils/useOrganization';

// export const EMPTY_INFINITE_LIST_DATA: ReturnType<
//   typeof useFetchFeedbackInfiniteListData
// > = {
//   getRow: () => undefined,
//   isError: false,
//   isLoading: false,
//   isRowLoaded: () => false,
//   loadMoreRows: () => Promise.resolve(),
//   queryView: EMPTY_QUERY_VIEW,
//   rowCount: 0,
//   rows: 0,
//   updateFeedback: () => undefined,
// };

// type LoadingState = 'missing' | 'fetching' | 'ready';

// function useInfiniteData({queryView}: {queryView: QueryView}) {
//   const api = useApi();
//   const organization = useOrganization();

//   // const [maxTimestamp, setMaxTimestamp] = useState(0);
//   const itemsRef = useRef<HydratedFeedbackItem[]>([]);
//   const stateRef = useRef<LoadingState[]>([]);
//   const [items, setItems] = useState<HydratedFeedbackItem[]>([]);
//   // const [states, setStates] = useState<LoadingState[]>([]);

//   const [totalRowCount, setTotalRowCount] = useState(0);
//   // const [loadedRowCount, setLoadedRowCount] = useState(0);

//   const setItemRange = useCallback(({fetchStart, fetchStop}, fetched) => {
//     const newItems = [
//       ...(fetchStart > 0 ? itemsRef.current.slice(0, fetchStart - 1) : []),
//       ...fetched,
//       ...itemsRef.current.slice(fetchStop + 1),
//     ];
//     itemsRef.current = newItems;
//     // setLoadedRowCount(newItems.length);
//     setItems(newItems);
//     console.log('setItemRange', {fetchStart, fetchStop, fetched}, itemsRef.current);
//   }, []);

//   const setStateRange = useCallback(({fetchStart, fetchStop}, state: LoadingState) => {
//     const newStates = [
//       ...(fetchStart > 0 ? stateRef.current.slice(0, fetchStart - 1) : []),
//       ...range(fetchStart, fetchStop).map(() => state),
//       ...stateRef.current.slice(fetchStop + 1),
//     ];
//     stateRef.current = newStates;
//     // setStates(newStates);
//   }, []);

//   const getNextMissingIndex = useCallback(({startIndex, stopIndex}) => {
//     const found = range(startIndex, stopIndex).findIndex(
//       index => !['fetching', 'ready'].includes(stateRef.current[index])
//     );
//     return found >= 0 ? found + startIndex : undefined;
//   }, []);

//   const getPrevItem = useCallback(({fetchStart}) => {
//     return itemsRef.current[fetchStart - 1];
//   }, []);

//   const fetch = useCallback(
//     async ({conditions, perPage}: {conditions: string[]; perPage: number}) => {
//       const [data, , resp]: ApiResult<FeedbackItemResponse[]> = await api.requestPromise(
//         `/organizations/${organization.slug}/feedback/`,
//         {
//           includeAllArgs: true,
//           query: {
//             ...queryView,
//             cursor: `0:0:0`,
//             per_page: perPage,
//             query: [queryView.query, conditions].filter(Boolean).join(' '),
//           },
//         }
//       );

//       const totalHits = decodeInteger(resp?.getResponseHeader('X-Hits'), 0);
//       setStateRange({fetchStart: 0, fetchStop: totalHits}, 'missing');

//       console.log('fetch - complete', {totalHits, data});

//       return {hydrated: data.map(hydrateFeedbackRecord), totalHits};
//     },
//     [api, organization, queryView, setStateRange]
//   );

//   const fetchRange = useCallback(
//     async ({startIndex, stopIndex}: IndexRange, refresh: boolean = false) => {
//       // If we're refreshing, then grab everything that was asked for
//       // otherwise look for new indexes that we havn't tried yet.
//       const fetchStart = refresh
//         ? startIndex
//         : getNextMissingIndex({startIndex, stopIndex});
//       const fetchStop = stopIndex;

//       // If we asked for something outside a valid range, then just bail
//       if (fetchStart === undefined) {
//         console.log(
//           'fetchRange - bail',
//           {startIndex, stopIndex, fetchStart, fetchStop},
//           stateRef.current
//         );
//         return;
//       }

//       const prevItem = getPrevItem({fetchStart});
//       const conditions = prevItem ? [`timestamp:<${prevItem.timestamp.getTime()}`] : [];
//       const perPage = fetchStop - fetchStart;
//       try {
//         console.log(
//           'fetchRange',
//           {startIndex, stopIndex},
//           {fetchStart, fetchStop},
//           {prevItem, conditions, perPage}
//         );
//         setStateRange({fetchStart, fetchStop}, 'fetching');
//         const {hydrated, totalHits} = await fetch({conditions, perPage});

//         setItemRange({fetchStart, fetchStop}, hydrated);
//         setStateRange({fetchStart, fetchStop}, 'ready');
//         setTotalRowCount(totalHits);
//       } catch (error) {
//         console.error({error});
//         setStateRange({fetchStart, fetchStop}, 'missing');
//       }
//     },
//     [fetch, setStateRange, setItemRange, getPrevItem, getNextMissingIndex]
//   );

//   return {
//     fetchRange,
//     items, // itemsRef.current,
//     loadedRowCount: items.length,
//     states: [...stateRef.current],
//     totalRowCount,
//   };
// }

// export default function useFetchFeedbackInfiniteListData({
//   queryView,
// }: {
//   queryView: QueryView;
// }) {
//   const {items, totalRowCount, loadedRowCount, states, fetchRange} = useInfiniteData({
//     queryView,
//   });

//   const getRow = useCallback(
//     ({index}: Index) => {
//       // console.log('getRow', {index});
//       return items[index] ?? undefined;
//     },
//     [items]
//   );

//   const isRowLoaded = useCallback(
//     ({index}: Index) => {
//       // console.log('isRowLoaded', {index});
//       return states[index] === 'ready';
//     },
//     [states]
//   );

//   const loadMoreRows = useCallback(
//     ({startIndex, stopIndex}: IndexRange) => {
//       console.log('loadMoreRows', {startIndex, stopIndex});
//       return fetchRange({startIndex, stopIndex});
//     },
//     [fetchRange]
//   );

//   const updateFeedback = useCallback(({feedbackId: _}: {feedbackId: string}) => {
//     // TODO
//   }, []);

//   useEffect(() => {
//     loadMoreRows({startIndex: 0, stopIndex: 10});
//   }, [loadMoreRows]);

//   console.log('list data', {totalRowCount, loadedRowCount});

//   return {
//     getRow,
//     isError: false,
//     isLoading: false,
//     isRowLoaded,
//     loadMoreRows,
//     queryView,
//     rowCount: totalRowCount,
//     rows: loadedRowCount,
//     updateFeedback,
//   };
// }
