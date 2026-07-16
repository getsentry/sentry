import {useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

const DATADOG_SITES = [
  {value: 'datadoghq.com', label: 'datadoghq.com (US1)'},
  {value: 'us3.datadoghq.com', label: 'us3.datadoghq.com (US3)'},
  {value: 'us5.datadoghq.com', label: 'us5.datadoghq.com (US5)'},
  {value: 'datadoghq.eu', label: 'datadoghq.eu (EU)'},
  {value: 'ddog-gov.com', label: 'ddog-gov.com (US1-FED)'},
  {value: 'us2.ddog-gov.com', label: 'us2.ddog-gov.com (US2-FED)'},
  {value: 'ap1.datadoghq.com', label: 'ap1.datadoghq.com (AP1)'},
  {value: 'ap2.datadoghq.com', label: 'ap2.datadoghq.com (AP2)'},
];

interface DatadogPatConnectModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgSlug: string;
  isReauth?: boolean;
}

export function DatadogPatConnectModal({
  Header,
  Body,
  Footer,
  closeModal,
  onSuccess,
  orgSlug,
  isReauth = false,
}: DatadogPatConnectModalProps) {
  const [accessToken, setAccessToken] = useState('');
  const [site, setSite] = useState('datadoghq.com');
  const [formError, setFormError] = useState<string | null>(null);

  const connectMutation = useMutation({
    mutationFn: () =>
      fetchMutation<void>({
        method: isReauth ? 'PUT' : 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/$providerKey/',
          {
            path: {
              organizationIdOrSlug: orgSlug,
              providerKey: 'datadog_pat',
            },
          }
        ),
        data: isReauth ? {access_token: accessToken} : {access_token: accessToken, site},
      }),
    onSuccess: () => {
      closeModal();
      onSuccess();
    },
    onError: (error: Error) => {
      if (error instanceof RequestError && error.responseJSON?.detail) {
        const detail = error.responseJSON.detail;
        setFormError(typeof detail === 'string' ? detail : (detail.message ?? ''));
      } else {
        addErrorMessage(t('Failed to connect provider.'));
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    connectMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Header>
        <h4>
          {isReauth
            ? t('Reconnect Datadog (Personal Access Token)')
            : t('Connect Datadog (Personal Access Token)')}
        </h4>
      </Header>
      <Body>
        <Stack gap="md">
          <Stack gap="xs">
            <Text as="label" htmlFor="datadog-pat-token">
              {t('Access Token')}
            </Text>
            <Input
              id="datadog-pat-token"
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder={t('Enter your Datadog personal access token')}
              aria-label={t('Access Token')}
            />
          </Stack>
          {!isReauth && (
            <Stack gap="xs">
              <Text as="label">{t('Datadog Site')}</Text>
              <StyledCompactSelect
                value={site}
                options={DATADOG_SITES}
                onChange={option => setSite(String(option.value))}
                trigger={triggerProps => (
                  <OverlayTrigger.Button
                    {...triggerProps}
                    aria-label={t('Datadog Site')}
                  />
                )}
              />
            </Stack>
          )}
          {formError ? <ErrorText role="alert">{formError}</ErrorText> : null}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="sm" align="center" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            type="submit"
            variant="primary"
            busy={connectMutation.isPending}
            disabled={!accessToken.trim()}
          >
            {t('Connect')}
          </Button>
        </Flex>
      </Footer>
    </form>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  > button {
    width: 100%;
  }
`;

const ErrorText = styled('div')`
  color: ${p => p.theme.tokens.content.danger};
  margin-top: ${p => p.theme.space.sm};
`;
