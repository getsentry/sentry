import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import {PROVIDER_TO_SETUP_WEBHOOK_URL} from 'sentry/components/events/featureFlags/utils';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelItem from 'sentry/components/panels/panelItem';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

function NewSecretHandler({
  secret,
  provider,
  onGoBack,
}: {
  onGoBack: MouseEventHandler;
  provider: string;
  secret: string;
}) {
  const organization = useOrganization();

  return (
    <div>
      <Alert type="success" showIcon system>
        {t('The secret has been posted.')}
      </Alert>

      <StyledPanelItem>
        <InputWrapper>
          <StyledFieldGroup
            label={t('Webhook URL')}
            help={tct(
              "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter this URL.",
              {
                link: (
                  <ExternalLink
                    href={
                      PROVIDER_TO_SETUP_WEBHOOK_URL[
                        provider.toLowerCase() as keyof typeof PROVIDER_TO_SETUP_WEBHOOK_URL
                      ]
                    }
                  />
                ),
              }
            )}
            inline
            flexibleControlStateSize
          >
            <TextCopyInput
              aria-label={t('Webhook URL')}
            >{`https://sentry.io/api/0/organizations/${organization.slug}/flags/hooks/provider/${provider.toLowerCase()}/`}</TextCopyInput>
          </StyledFieldGroup>
          <StyledFieldGroup
            label={t('Secret')}
            help={t(
              'The secret should not be shared and will not be retrievable once you leave this page.'
            )}
            inline
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('Secret')}>{secret}</TextCopyInput>
          </StyledFieldGroup>
        </InputWrapper>
      </StyledPanelItem>

      <StyledPanelItem>
        <ButtonWrapper>
          <Button onClick={onGoBack} priority="primary">
            {t('Done')}
          </Button>
        </ButtonWrapper>
      </StyledPanelItem>
    </div>
  );
}

const InputWrapper = styled('div')`
  flex: 1;
`;

const StyledFieldGroup = styled(FieldGroup)`
  padding: ${space(1)};
`;

const ButtonWrapper = styled('div')`
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: ${p => p.theme.fontSizeSmall};
  gap: ${space(1)};
`;

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(1.5)};
`;

export default NewSecretHandler;
