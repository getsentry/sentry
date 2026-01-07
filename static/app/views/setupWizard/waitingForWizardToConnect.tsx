import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {useSetupWizardCompletedAnalytics} from 'sentry/views/setupWizard/utils/setupWizardAnalytics';

export function WaitingForWizardToConnect({
  hash,
  organizations,
}: {
  hash: string;
  organizations: Organization[];
}) {
  const api = useApi();
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const [finished, setFinished] = useState(false);

  const trackWizardCompleted = useSetupWizardCompletedAnalytics(organizations);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

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
      trackWizardCompleted();
    }
  }, [api, hash, trackWizardCompleted, finished]);

  useEffect(() => {
    const pollingInterval = window.setInterval(checkFinished, 1000);
    return () => window.clearInterval(pollingInterval);
  }, [checkFinished]);

  return finished ? (
    <Flex align="center" gap="2xl">
      <SuccessCheckmark variant="success" size="xl" />
      <SuccessHeading>
        {t('Return to your terminal to complete your setup.')}
      </SuccessHeading>
    </Flex>
  ) : (
    <LoadingIndicator style={{margin: '2em auto'}}>
      <h5>{t('Waiting for wizard to connect')}</h5>
    </LoadingIndicator>
  );
}

const SuccessCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

const SuccessHeading = styled('h5')`
  margin: 0;
`;
