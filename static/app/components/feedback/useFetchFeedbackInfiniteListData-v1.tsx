// import {useCallback, useEffect, useRef, useState} from 'react';
// import type {Index, IndexRange} from 'react-virtualized';
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

// // export interface FeedbackInfiniteListData {
// //   getIndex: ({index}: Index) => undefined | HydratedFeedbackItem;
// //   hasIndex: ({index}: Index) => boolean;
// //   isError: boolean;
// //   isLoading: boolean;
// //   loadMoreRows: ({}: IndexRange) => Promise<void>;
// //   queryView: QueryView;
// //   rowCount: number;
// //   updateById: ({index}: Index) => void;
// // }

// export const EMPTY_INFINITE_LIST_DATA: ReturnType<
//   typeof useFetchFeedbackInfiniteListData
// > = {
//   getIndex: () => undefined,
//   hasIndex: () => false,
//   isError: false,
//   isLoading: false,
//   loadMoreRows: () => Promise.resolve(),
//   queryView: EMPTY_QUERY_VIEW,
//   rowCount: 0,
//   updateById: () => undefined,
// };

// type LoadingState = 'fetching' | 'ready';

// export default function useFetchFeedbackInfiniteListData({
//   queryView,
// }: {
//   queryView: QueryView;
// }) {
//   console.log({queryView});

//   const organization = useOrganization();
//   const api = useApi();

//   // How many items are related to this query?
//   const [rowCount, setRowCount] = useState(0);
//   // What track what data we've fetched, what's in progress
//   const loadingState = useRef(new Map<number, LoadingState>());
//   // The actual data
//   const [items, setItems] = useState<HydratedFeedbackItem[]>([]);

//   // When the queryView changes, we reset the state
//   useEffect(() => {
//     console.log('reset the state');
//     setRowCount(Number.MAX_SAFE_INTEGER);
//     loadingState.current.clear();
//     setItems([]);
//   }, [queryView]);

//   const getIndex = useCallback(({index}: Index) => items[index], [items]);
//   const hasIndex = useCallback(
//     ({index}: Index) => loadingState.current.get(index) === 'ready',
//     []
//   );

//   const updateById = useCallback((feedbackId: string) => {
//     // given a feedback id, go find it and delete it
//   }, []);

//   const loadMoreRows = useCallback(
//     async ({startIndex, stopIndex}: IndexRange) => {
//       console.log('loadMoreRows', {startIndex, stopIndex});

//       // If we have already requested some of these, then we can skip it
//       const fetchStart = range(startIndex, stopIndex).findIndex(
//         index => !loadingState.current.has(index)
//       );
//       const fetchStop = stopIndex;
//       if (fetchStart < 0) {
//         // We're already fetching the same data
//         return;
//       }

//       console.log('mark fetching', {fetchStart, fetchStop});
//       range(fetchStart, fetchStop).forEach(i => loadingState.current.set(i, 'fetching'));
//       const lastItem = items[fetchStart - 1];
//       const idCondition = lastItem ? `id:>${lastItem.feedback_id}` : undefined;
//       const perPage = fetchStop - fetchStart;
//       console.log('request', {lastItem, idCondition, perPage});

//       const [data, , resp] = (await api.requestPromise(
//         `/organizations/${organization.slug}/feedback/`,
//         {
//           includeAllArgs: true,
//           query: {
//             ...queryView,
//             query: [queryView.query, idCondition].join(' '),
//             cursor: `0:0:0`,
//             per_page: perPage,
//           },
//         }
//       )) as ApiResult<FeedbackItemResponse[]>;
//       const totalHits = decodeInteger(resp?.getResponseHeader('X-Hits'), data.length);
//       console.log({data, totalHits});
//       setRowCount(Number(totalHits));
//       range(startIndex, stopIndex).forEach(i => loadingState.current.set(i, 'ready'));
//       const hydratedFeedbacks = data.map(hydrateFeedbackRecord);
//       setItems(prev => {
//         prev.splice(startIndex, perPage, ...hydratedFeedbacks);
//         return prev;
//       });
//     },
//     [api, items, organization, queryView]
//   );

//   return {
//     getIndex,
//     hasIndex,
//     isError: false,
//     isLoading: false,
//     loadMoreRows,
//     queryView,
//     updateById,
//     rowCount,
//   };
// }
