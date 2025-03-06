import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import {Input} from 'sentry/components/core/input';
import {
  PROVIDER_TO_SETUP_WEBHOOK_URL,
  WebhookProviderEnum,
} from 'sentry/components/events/featureFlags/utils';
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
import {makeFetchSecretQueryKey} from 'sentry/views/settings/featureFlags/changeTracking';
import type {
  CreateSecretQueryVariables,
  CreateSecretResponse,
} from 'sentry/views/settings/featureFlags/changeTracking/newProviderForm';

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
          <Flex gap={space(2)} column>
            <div>
              {tct(
                'Change tracking enables Sentry to listen for your feature flag updates. The change log appears in the event volume chart on Issue Details and presents itself as a vertical line, similar to a release line. Setting up change tracking also allows us to notify you of potential suspect flags. Learn more by [link:reading the docs].',
                {
                  link: (
                    <ExternalLink
                      href={
                        'https://docs.sentry.io/product/issues/issue-details/feature-flags/#change-tracking'
                      }
                    />
                  ),
                }
              )}
            </div>
            <div>
              {tct(
                "To set up change tracking, create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter a URL, which you can find below.",
                {
                  link: (
                    <ExternalLink
                      href={
                        PROVIDER_TO_SETUP_WEBHOOK_URL[provider as WebhookProviderEnum]
                      }
                    />
                  ),
                }
              )}
            </div>
          </Flex>
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
            {provider === WebhookProviderEnum.UNLEASH
              ? t(
                  `During the process of creating a webhook integration, you'll be given the option to add an authorization header. This is a string (or "secret") that you choose so that Sentry can verify requests from your feature flag service. Paste your authorization string below.`
                )
              : t(
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
  margin-top: ${space(1)};
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
