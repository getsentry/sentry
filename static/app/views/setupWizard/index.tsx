import {useCallback, useEffect, useRef, useState} from 'react';

import Button from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

type Props = {
  hash?: boolean | string;
};

function SetupWizard({hash = false}: Props) {
  const api = useApi();
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  });

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimeoutRef.current);
    };
  });

  const checkFinished = useCallback(async () => {
    try {
      await api.requestPromise(`/wizard/${hash}/`);
    } catch {
      setFinished(true);
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = window.setTimeout(() => window.close(), 10000);
    }
  }, [api, hash]);

  useEffect(() => {
    const pollingInterval = window.setInterval(checkFinished, 1000);
    return () => window.clearInterval(pollingInterval);
  }, [checkFinished]);

  return (
    <ThemeAndStyleProvider>
      <div className="container">
        {!finished ? (
          <LoadingIndicator style={{margin: '2em auto'}}>
            <div className="row">
              <h5>{t('Waiting for wizard to connect')}</h5>
            </div>
          </LoadingIndicator>
        ) : (
          <div className="row">
            <h5>{t('Return to your terminal to complete your setup')}</h5>
            <h5>{t('(This window will close in 10 seconds)')}</h5>
            <Button onClick={() => window.close()}>{t('Close browser tab')}</Button>
          </div>
        )}
      </div>
    </ThemeAndStyleProvider>
  );
}

export default SetupWizard;
