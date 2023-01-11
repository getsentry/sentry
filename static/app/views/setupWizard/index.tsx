import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

type Props = {
  hash?: boolean | string;
};

const platformDocsMapping = {
  'javascript-nextjs':
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/#verify',
  'react-native': 'https://docs.sentry.io/platforms/react-native/#verify',
  cordova: 'https://docs.sentry.io/platforms/javascript/guides/cordova/#verify',
  'javascript-electron':
    'https://docs.sentry.io/platforms/javascript/guides/electron/#verify',
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

  // outside of route context
  const docsLink = useMemo(() => {
    const urlParams = new URLSearchParams(location.search);
    const projectPlatform = urlParams.get('project_platform');
    return platformDocsMapping[projectPlatform || ''] || 'https://docs.sentry.io/';
  }, []);

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
            <MinWidthButtonBar gap={1}>
              <Button priority="primary" to="/">
                {t('View Issues')}
              </Button>
              <Button href={docsLink} external>
                {t('See Docs')}
              </Button>
            </MinWidthButtonBar>
          </div>
        )}
      </div>
    </ThemeAndStyleProvider>
  );
}

const MinWidthButtonBar = styled(ButtonBar)`
  width: min-content;
  margin-top: 20px;
`;

export default SetupWizard;
