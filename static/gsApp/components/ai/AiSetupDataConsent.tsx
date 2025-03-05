import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import {useGenAiConsentButtonAccess} from 'getsentry/hooks/genAiAccess';
import type {Subscription} from 'getsentry/types';

type AiSetupDataConsentProps = {
  groupId: string;
};

function AiSetupDataConsent({
  groupId,
  subscription,
}: AiSetupDataConsentProps & {
  subscription: Subscription;
}) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const endpoint = `/organizations/${organization.slug}/data-consent/`;

  const genAiConsentMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(endpoint, {
        method: 'PUT',
        data: {
          genAIConsent: true,
        },
      });
    },
    onSuccess: () => {
      // Make sure this query key doesn't go out of date with the one on the Sentry side!
      queryClient.invalidateQueries({queryKey: [`/issues/${groupId}/autofix/setup/`]});
    },
  });

  const {isDisabled, message} = useGenAiConsentButtonAccess({
    subscription,
  });

  return (
    <ConsentItemsContainer>
      <HeaderItem>
        <Title>Consent to Data Usage</Title>
        <Paragraph>
          {t(
            "As part of Sentry's privacy-first approach to data usage, we require explicit permissions to access your data for generative AI-based features."
          )}
        </Paragraph>
      </HeaderItem>
      <ConsentItem>
        <ConsentTitle>{t('What data do we access?')}</ConsentTitle>
        <Paragraph>
          {t(
            "Sentry's generative AI features use relevant data, including error messages, stack traces, spans, DOM interactions, and code from your linked repositories."
          )}
        </Paragraph>
      </ConsentItem>
      <ConsentItem>
        <ConsentTitle>{t('How do we use it?')}</ConsentTitle>
        <Paragraph>
          {t(
            'We use the data to provide you with insights, analyses, summaries, suggested fixes and other product capabilities. Your data will not be used to train any models or to generate output shown to others.'
          )}
        </Paragraph>
      </ConsentItem>
      <ConsentItem>
        <ConsentTitle>{t('Where does it go?')}</ConsentTitle>
        <Paragraph>
          {t(
            'This feature is powered by generative AI models hosted by the feature-specific subprocessors identified on our subprocessor list. Our subprocessors will only use the data as directed by us.'
          )}
        </Paragraph>
      </ConsentItem>
      <ButtonWrapper>
        <Button
          priority="primary"
          onClick={() => genAiConsentMutation.mutate()}
          disabled={isDisabled || genAiConsentMutation.isPending}
          analyticsEventKey="gen_ai_consent.in_drawer_clicked"
          analyticsEventName="Gen AI Consent: Clicked In Drawer"
          size="sm"
          title={message}
        >
          {genAiConsentMutation.isPending ? (
            <StyledLoadingIndicator size={14} mini />
          ) : (
            t('I Agree')
          )}
        </Button>
        <LinkButton
          external
          href="/settings/legal/#genAIConsent"
          size="sm"
          analyticsEventKey="gen_ai_consent.view_in_settings_clicked"
          analyticsEventName="Gen AI Consent: View in Settings Clicked"
        >
          View in Settings
        </LinkButton>
        {genAiConsentMutation.isError && (
          <ErrorText>{t('Something went wrong.')}</ErrorText>
        )}
      </ButtonWrapper>
    </ConsentItemsContainer>
  );
}

export default withSubscription(AiSetupDataConsent);

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
    height: 14px;
    width: 14px;
  }
`;

const ErrorText = styled('div')`
  color: ${p => p.theme.error};
`;
