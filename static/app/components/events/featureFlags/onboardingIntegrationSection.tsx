import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {PROVIDER_OPTION_TO_URLS} from 'sentry/components/events/featureFlags/utils';
import Input from 'sentry/components/input';
import ExternalLink from 'sentry/components/links/externalLink';
import TextCopyInput from 'sentry/components/textCopyInput';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchSecretQueryKey} from 'sentry/views/settings/featureFlags';
import type {
  CreateSecretQueryVariables,
  CreateSecretResponse,
} from 'sentry/views/settings/featureFlags/newProviderForm';

export default function OnboardingIntegrationSection({
  provider,
  integration,
}: {
  integration: string;
  provider: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const {mutate: submitSecret, isPending} = useMutation<
    CreateSecretResponse,
    RequestError,
    CreateSecretQueryVariables
  >({
    mutationFn: ({secret}) => {
      addLoadingMessage();
      return api.requestPromise(
        `/organizations/${organization.slug}/flags/signing-secrets/`,
        {
          method: 'POST',
          data: {
            provider: provider.toLowerCase(),
            secret,
          },
        }
      );
    },

    onSuccess: () => {
      addSuccessMessage(t('Added provider and secret.'));
      setSecretSaved(true);
      queryClient.invalidateQueries({
        queryKey: makeFetchSecretQueryKey({orgSlug: organization.slug}),
      });
    },
    onError: error => {
      const message = t('Failed to add provider or secret.');
      setSecretSaved(false);
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  const [secretSaved, setSecretSaved] = useState(false);
  const [secret, setSecret] = useState('');
  const [storedProvider, setStoredProvider] = useState(provider);
  const [storedIntegration, setStoredIntegration] = useState(integration);

  if (provider !== storedProvider || integration !== storedIntegration) {
    setStoredProvider(provider);
    setStoredIntegration(integration);
    setSecret('');
    setSecretSaved(false);
  }

  const canRead = hasEveryAccess(['org:read'], {organization});
  const canWrite = hasEveryAccess(['org:write'], {organization});
  const canAdmin = hasEveryAccess(['org:admin'], {organization});
  const hasAccess = canRead || canWrite || canAdmin;

  return (
    <Fragment>
      <h4 style={{marginTop: space(4)}}>{t('Integrate Feature Flag Service')}</h4>
      <IntegrationSection>
        <SubSection>
          <div>
            {tct(
              "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter a URL, which you can find below.",
              {
                link: <ExternalLink href={PROVIDER_OPTION_TO_URLS[provider]} />,
              }
            )}
          </div>
          <InputTitle>{t('Webhook URL')}</InputTitle>
          <TextCopyInput
            style={{padding: '20px'}}
            aria-label={t('Webhook URL')}
            size="sm"
          >
            {`https://sentry.io/api/0/organizations/${organization.slug}/flags/hooks/provider/${provider.toLowerCase()}/`}
          </TextCopyInput>
        </SubSection>
        <SubSection>
          <div>
            {t(
              "During the process of creating a webhook integration, you'll be given the option to sign the webhook. This is an auto-generated secret code that Sentry requires to verify requests from your feature flag service. Paste the secret below."
            )}
          </div>
          <InputTitle>{t('Secret')}</InputTitle>
          <InputArea>
            <Input
              maxLength={32}
              minLength={32}
              required
              value={secret}
              type="text"
              placeholder={t('Secret')}
              onChange={e => setSecret(e.target.value)}
            />
            <Tooltip
              title={t('You must be an organization member to add a secret.')}
              disabled={hasAccess}
            >
              <Button
                priority="default"
                onClick={() => submitSecret({provider, secret})}
                disabled={secret.length < 32 || secret === '' || !hasAccess || isPending}
              >
                {t('Save Secret')}
              </Button>
            </Tooltip>
          </InputArea>
          {secretSaved ? (
            <StyledAlert showIcon type="success" icon={<IconCheckmark />}>
              {t('Secret verified.')}
            </StyledAlert>
          ) : secret ? (
            <StyledAlert showIcon type="warning" icon={<IconWarning />}>
              {t('Make sure the secret is 32 characters long.')}
            </StyledAlert>
          ) : null}
        </SubSection>
      </IntegrationSection>
    </Fragment>
  );
}

const InputTitle = styled('div')`
  font-weight: bold;
`;

const InputArea = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
`;

const IntegrationSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  margin: ${space(3)} 0;
`;

const SubSection = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const StyledAlert = styled(Alert)`
  margin: ${space(1.5)} 0 0 0;
`;
