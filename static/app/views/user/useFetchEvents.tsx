import {useApiQuery} from 'sentry/utils/queryClient';
import { useLocation } from "sentry/utils/useLocation";
import { FetchEventsResponse, FetchOptions, FetchTransactionResponse } from "./types";
import {ReplayListLocationQuery} from 'sentry/views/replays/types';
import useOrganization from "sentry/utils/useOrganization";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { decodeScalar } from "sentry/utils/queryString";
import { MutableSearch } from "sentry/utils/tokenizeSearch";
import EventView from "sentry/utils/discover/eventView";


export function useFetchErrors(options: FetchOptions) {
  return useFetchEvents<FetchEventsResponse>({...options, type: 'error'});
}

export function useFetchTransactions(options: FetchOptions) {
  return useFetchEvents<FetchTransactionResponse>({...options, type: 'transaction'});
}

interface State {
  isInfiniteFetching: boolean;
  timestamp: null | number;
  results: null | any;
}

function reducer(state, action) {
  if (action.type === 'incremented_age') {
    return {
      age: state.age + 1
    };
  }
  throw Error('Unknown action.');
}

export function useFetchEvents<T extends FetchEventsResponse>({
  userId,
  type,
  infiniteRef,
  limit = 5,
}: {
  type: 'error' | 'transaction';
  } & FetchOptions
) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const observer = useRef<null | IntersectionObserver>(null);
  const busy = useRef<boolean>(false);
  const [state, dispatch] = useReducer(reducer, {
    isInfiniteFetching: false,
    timestamp: null,
    results: null,
  });

  useEffect(() => {
    if (infiniteRef && infiniteRef.current && !observer.current) {
    console.log('useEffect, fetchEvents, observing', observer.current);

    observer.current = new IntersectionObserver(
        (entries) => {
        const first = entries[0];
        console.log('observer')
        if (first.isIntersecting) {
        console.log('useFetchEvents inf loading hit');
        doFetch();
        // Do fetch
        }
        });
    observer.current.observe(infiniteRef.current);
    }

    return () => {
    console.log('events useEffect cleanup', infiniteRef?.current, observer.current)
    }
  })


  function doFetch() {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('user.id', userId);
    conditions.addFilterValue('event.type', type);
    if (state.timestamp) {
      conditions.addFreeText(`timestamp:>${state.timestamp}`)
    }

      // field: title
      // field: event.type
      // field: project.id
      // field: timestamp
      // per_page: 50
      // project: 11276
      // query: user.email%3Abilly%40sentry.io
      // referrer: api.discover.query-table
      // sort: -timestamp
      // statsPeriod: 7d

    const fields = [
      'message',
      'timestamp',
      'event.type',
      'project.id',
      'project',
      'os.name',
      'os.version',
      'browser.name',
      'browser.version',
    ];

    if (type === 'transaction') {
      fields.push('transaction.duration');
      fields.push('span_ops_breakdown.relative');
      fields.push('spans.browser');
      fields.push('spans.db');
      fields.push('spans.http');
      fields.push('spans.resource');
      fields.push('spans.ui');
      fields.push('transaction.duration');
    }

    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields,
        projects: [],
        query: conditions.formatString(),
        orderby: '-timestamp',
      },
      location
    );

    const payload = eventView.getEventsAPIPayload(location);
    payload.per_page = limit;
    payload.sort = ['-timestamp', 'message'];

    const results = useApiQuery<T>(
      [
        `/organizations/${organization.slug}/events/`,
        {
          query: {
            ...payload,
            queryReferrer: 'issueReplays',
          },
        },
      ],
      {staleTime: 0, retry: false}
    );

setState()



  }

  const payload = eventView.getEventsAPIPayload(location);
  payload.per_page = limit;
  payload.sort = ['-timestamp', 'message'];

  const results = useApiQuery<T>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...payload,
          queryReferrer: 'issueReplays',
        },
      },
    ],
    {staleTime: 0, retry: false}
  );

  return {
    events: results.data?.data,
    isFetching: results.isLoading,
    fetchError: results.error,
    eventView,
  };
}
