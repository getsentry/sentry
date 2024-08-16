import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export function useDataset(): [DiscoverDatasets, (dataset: DiscoverDatasets) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useDatasetImpl(options);
}

function useDatasetImpl({
  location,
  navigate,
}: Options): [DiscoverDatasets, (dataset: DiscoverDatasets) => void] {
  const dataset: DiscoverDatasets = useMemo(() => {
    const rawDataset = decodeScalar(location.query.dataset);
    if (rawDataset === 'spans') {
      return DiscoverDatasets.SPANS_EAP;
    }
    return DiscoverDatasets.SPANS_INDEXED;
  }, [location.query.dataset]);

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
