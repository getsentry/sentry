import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {PROVIDER_OPTION_TO_URLS} from 'sentry/components/events/featureFlags/utils';
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
      <StyledAlert type="success" showIcon system>
        {t('The secret has been posted.')}
      </StyledAlert>

      <StyledPanelItem>
        <InputWrapper>
          <StyledFieldGroup
            label={t('Webhook URL')}
            help={tct(
              "Create a webhook integration with your [link:feature flag service]. When you do so, you'll need to enter this URL.",
              {
                link: (
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  <ExternalLink href={PROVIDER_OPTION_TO_URLS[provider.toLowerCase()]} />
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

const StyledAlert = styled(Alert)`
  margin: 0;
`;
export default NewSecretHandler;
