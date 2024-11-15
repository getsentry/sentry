import {useCallback, useEffect, useState} from 'react';

import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';

export function useStatusPageList() {
  const isMountedRef = useIsMountedRef();
  const [mod, setMod] = useState<any>({});

  const loader = useCallback(async () => {
    const loaded = await import('@sentry/status-page-list');

    if (isMountedRef.current) {
      setMod(loaded);
    }
  }, [isMountedRef]);

  useEffect(() => {
    loader();
  }, [loader]);

  return mod;
}
