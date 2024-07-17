import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';

type Props = {
  hash?: boolean | string;
  organizations?: Organization[];
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
      {!finished ? (
        <LoadingIndicator style={{margin: '2em auto'}}>
          <h5>{t('Waiting for wizard to connect')}</h5>
        </LoadingIndicator>
      ) : (
        <SuccessWrapper>
          <SuccessCheckmark color="green300" size="xl" isCircled />
          <SuccessHeading>
            {t('Return to your terminal to complete your setup.')}
          </SuccessHeading>
        </SuccessWrapper>
      )}
    </ThemeAndStyleProvider>
  );
}

const SuccessCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

const SuccessHeading = styled('h5')`
  margin: 0;
`;

const SuccessWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

export default SetupWizard;
