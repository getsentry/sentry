import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';

type Props = {
  hash?: boolean | string;
  organizations?: Organization[];
};

const platformDocsMapping = {
  'javascript-nextjs':
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/#verify',
  'javascript-sveltekit':
    'https://docs.sentry.io/platforms/javascript/guides/sveltekit/#verify',
  'react-native': 'https://docs.sentry.io/platforms/react-native/#verify',
  cordova: 'https://docs.sentry.io/platforms/javascript/guides/cordova/#verify',
  'javascript-electron':
    'https://docs.sentry.io/platforms/javascript/guides/electron/#verify',
};

function SetupWizard({hash = false, organizations}: Props) {
  const api = useApi();
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const [finished, setFinished] = useState(false);

  // if we have exactly one organization, we can use it for analytics
  // otherwise we don't know which org the user is in
  const organization = useMemo(
    () => (organizations?.length === 1 ? organizations[0] : null),
    [organizations]
  );
  const urlParams = new URLSearchParams(location.search);
  const projectPlatform = urlParams.get('project_platform') ?? undefined;

  const analyticsParams = useMemo(
    () => ({
      organization,
      project_platform: projectPlatform,
    }),
    [organization, projectPlatform]
  );

  // outside of route context
  const docsLink = useMemo(() => {
    return platformDocsMapping[projectPlatform || ''] || 'https://docs.sentry.io/';
  }, [projectPlatform]);

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

  useEffect(() => {
    trackAnalytics('setup_wizard.viewed', analyticsParams);
  }, [analyticsParams]);

  const checkFinished = useCallback(async () => {
    if (finished) {
      return;
    }
    try {
      await api.requestPromise(`/wizard/${hash}/`);
    } catch {
      setFinished(true);
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = window.setTimeout(() => window.close(), 10000);
      trackAnalytics('setup_wizard.complete', analyticsParams);
    }
  }, [api, hash, analyticsParams, finished]);

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
            <MinWidthButtonBar gap={1}>
              <Button
                priority="primary"
                to="/"
                onClick={() =>
                  trackAnalytics('setup_wizard.clicked_viewed_issues', analyticsParams)
                }
              >
                {t('View Issues')}
              </Button>
              <Button
                href={docsLink}
                external
                onClick={() =>
                  trackAnalytics('setup_wizard.clicked_viewed_docs', analyticsParams)
                }
              >
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
