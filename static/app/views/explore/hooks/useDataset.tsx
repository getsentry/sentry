import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  allowRPC?: boolean;
}

interface UseDatasetOptions {
  allowRPC?: boolean;
}

export function useDataset(
  options?: UseDatasetOptions
): [DiscoverDatasets, (dataset: DiscoverDatasets) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  return useDatasetImpl({location, navigate, allowRPC: options?.allowRPC});
}

function useDatasetImpl({
  location,
  navigate,
  allowRPC,
}: Options): [DiscoverDatasets, (dataset: DiscoverDatasets) => void] {
  const dataset: DiscoverDatasets = useMemo(() => {
    const rawDataset = decodeScalar(location.query.dataset);
    if (rawDataset === 'spansIndexed') {
      return DiscoverDatasets.SPANS_INDEXED;
    }

    if (allowRPC && rawDataset === 'spansRpc') {
      return DiscoverDatasets.SPANS_EAP_RPC;
    }

    return DiscoverDatasets.SPANS_EAP;
  }, [location.query.dataset, allowRPC]);

  const setDataset = useCallback(
    (newDataset: DiscoverDatasets) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          dataset: newDataset,
        },
      });
    },
    [location, navigate]
  );

  return [dataset, setDataset];
}
