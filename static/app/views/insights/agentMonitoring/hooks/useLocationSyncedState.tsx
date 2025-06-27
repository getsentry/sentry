import {startTransition, useCallback, useEffect, useRef, useState} from 'react';
import {type LocationDescriptor, type LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import type {
  decodeBoolean,
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
  QueryValue,
} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';

type KnownDecoder =
  | typeof decodeInteger
  | typeof decodeList
  | typeof decodeScalar
  | typeof decodeSorts
  | typeof decodeBoolean;

type GenericDecoder<T = unknown> = (query: QueryValue) => T;

type Decoder = KnownDecoder | GenericDecoder;

/**
 * Creates a local state that is synced with the URL.
 * URL updates are deferred, so the UI will feel more responsive.
 * @returns
 */
export function useLocationSyncedState<T extends Decoder>(key: string, decoder: T) {
  const navigate = useNavigate();
  const fields = useLocationQuery({
    fields: {
      [key]: decoder,
    },
  });
  const urlParam = fields[key];
  const [state, setState] = useState(urlParam);

  // Sync URL updates to the local state
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (stateRef.current !== urlParam) {
      setState(urlParam);
    }
  }, [urlParam]);

  const updateLocation = useCallback(
    (updater: (query: LocationDescriptorObject) => LocationDescriptor) => {
      // We need to operate on the up-to-date location, to avoid race conditions
      const previousLocation = {
        ...window.location,
        query: {
          ...qs.parse(window.location.search),
        },
      };
      startTransition(() => {
        navigate(updater(previousLocation), {replace: true, preventScrollReset: true});
      });
    },
    [navigate]
  );

  const removeQueryParam = useCallback(() => {
    updateLocation(prevLocation => ({
      ...prevLocation,
      query: omit(prevLocation.query, key),
    }));
  }, [updateLocation, key]);

  const handleUpdate = useCallback(
    (value: typeof urlParam) => {
      setState(value);
      updateLocation(prevLocation => ({
        ...prevLocation,
        query: {
          ...prevLocation.query,
          [key]: value,
        },
      }));
    },
    [updateLocation, key]
  );

  return [state, handleUpdate, removeQueryParam] as const;
}
