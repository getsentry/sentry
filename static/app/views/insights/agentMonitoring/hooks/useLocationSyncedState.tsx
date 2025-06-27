import {startTransition, useCallback, useEffect, useRef, useState} from 'react';
import type {LocationDescriptor, LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';

import type {
  decodeBoolean,
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
  QueryValue,
} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
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
  const location = useLocation();
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
      startTransition(() => {
        navigate(updater(location), {replace: true, preventScrollReset: true});
      });
    },
    [navigate, location]
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
