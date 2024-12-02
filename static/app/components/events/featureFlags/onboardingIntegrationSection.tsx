import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {PROVIDER_OPTION_TO_URLS} from 'sentry/components/events/featureFlags/utils';
import Input from 'sentry/components/input';
import ExternalLink from 'sentry/components/links/externalLink';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

function usePostSecret({
  orgSlug,
  provider,
}: {
  orgSlug: string | undefined;
  provider: string;
}) {
  const api = useApi();

  const postSecret = async (secret: string) =>
    await api.requestPromise(
      `/organizations/${orgSlug}/flags/hooks/provider/${provider.toLowerCase()}/signing-secret/`,
      {
        method: 'POST',
        data: {
          secret: secret,
        },
      }
    );

  return {postSecret};
}

export default function OnboardingIntegrationSection({
  provider,
  integration,
}: {
  integration: string;
  provider: string;
}) {
  const organization = useOrganization();
  const [tokenSaved, setTokenSaved] = useState(false);
  const {postSecret} = usePostSecret({provider, orgSlug: organization?.slug});
  const [secret, setSecret] = useState('');
  const [storedProvider, setStoredProvider] = useState(provider);
  const [storedIntegration, setStoredIntegration] = useState(integration);

  if (provider !== storedProvider || integration !== storedIntegration) {
    setStoredProvider(provider);
    setStoredIntegration(integration);
    setSecret('');
    setTokenSaved(false);
  }

  return (
    <Fragment>
      <h4 style={{marginTop: space(4)}}>{t('Integrate Feature Flag Service')}</h4>
      <IntegrationSection>
        <SubSection>
          <div>
            {tct(
              "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter a URL, which you can find below.",
              {link: <ExternalLink href={PROVIDER_OPTION_TO_URLS[provider]} />}
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
              value={secret}
              type="text"
              placeholder={t('Secret')}
              onChange={e => setSecret(e.target.value)}
            />
            <Button
              priority="default"
              onClick={() => {
                postSecret(secret);
                setTokenSaved(true);
              }}
              disabled={secret === ''}
            >
              {t('Save Secret')}
            </Button>
          </InputArea>
          {tokenSaved ? (
            <StyledAlert showIcon type="success" icon={<IconCheckmark />}>
              {t('Secret token verified.')}
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
