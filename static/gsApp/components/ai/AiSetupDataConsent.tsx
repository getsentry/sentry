import styled from '@emotion/styled';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/core/button';
import type {AutofixSetupResponse} from 'sentry/components/events/autofix/useAutofixSetup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type AiSetupDataConsentProps = {
  groupId: string;
  setupAcknowledgement: AutofixSetupResponse['setupAcknowledgement'];
};

function AiSetupDataConsent({groupId, setupAcknowledgement}: AiSetupDataConsentProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const genAiConsentMutation = useMutation({
    mutationFn: () => {
      return promptsUpdate(api, {
        organization,
        feature: 'seer_autofix_setup_acknowledged',
        status: 'dismissed',
      });
    },
    onSuccess: () => {
      // Make sure this query key doesn't go out of date with the one on the Sentry side!
      queryClient.invalidateQueries({queryKey: [`/issues/${groupId}/autofix/setup/`]});
    },
  });

  return (
    <ConsentItemsContainer>
      <HeaderItem>
        <Title>{t('With Seer you get:')}</Title>
      </HeaderItem>
      <ConsentItem>
        <ConsentTitle>{t('Issue Summaries')}</ConsentTitle>
        <Paragraph>
          {t(
            "The fastest way to see what's going on, incorporating all data in the issue."
          )}
        </Paragraph>
      </ConsentItem>
      <ConsentItem>
        <ConsentTitle>{t('Root Cause Analysis')}</ConsentTitle>
        <Paragraph>
          {t('A streamlined, collaborative workflow to find the root cause.')}
        </Paragraph>
      </ConsentItem>
      <ConsentItem>
        <ConsentTitle>{t('Solutions & Code Changes')}</ConsentTitle>
        <Paragraph>
          {t('Proposed fixes with test cases, ready to merge as draft pull requests.')}
        </Paragraph>
      </ConsentItem>
      <ButtonWrapper>
        <Button
          priority="primary"
          onClick={() => genAiConsentMutation.mutate()}
          disabled={genAiConsentMutation.isPending}
          analyticsEventKey="gen_ai_consent.in_drawer_clicked"
          analyticsEventName="Gen AI Consent: Clicked In Drawer"
          size="sm"
        >
          {genAiConsentMutation.isPending ? (
            <StyledLoadingIndicator size={14} />
          ) : setupAcknowledgement?.orgHasAcknowledged ? (
            t('Enable Seer')
          ) : (
            t('Try Seer')
          )}
        </Button>
        {genAiConsentMutation.isError && (
          <ErrorText>{t('Something went wrong.')}</ErrorText>
        )}
      </ButtonWrapper>
      {!setupAcknowledgement?.orgHasAcknowledged && (
        <Paragraph>
          {tct(
            'Seer models are powered by generative Al. Per our [dataLink:data usage policies]. Sentry does not use your data to train Seer models or share your data with other customers without your express consent.',
            {
              dataLink: (
                <ExternalLink href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-identifying-data-for-generative-ai-features" />
              ),
            }
          )}
        </Paragraph>
      )}
    </ConsentItemsContainer>
  );
}

export default AiSetupDataConsent;

const ConsentItemsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const HeaderItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const ConsentItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  background-color: ${p => p.theme.background};
  padding: ${space(1)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

const Title = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Paragraph = styled('p')`
  margin: 0;
`;

const ConsentTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ButtonWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    /* margin: 0 ${space(0.5)} 0 ${space(1)}; */
  }
`;

const ErrorText = styled('div')`
  color: ${p => p.theme.error};
`;
