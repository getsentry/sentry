import {Fragment} from 'react';
import styled from '@emotion/styled';

import autofixSetupImg from 'sentry-images/features/autofix-setup.svg';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {SeerWaitingIcon} from 'sentry/components/ai/SeerIcon';
import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import StartTrialButton from 'getsentry/components/startTrialButton';
import useSubscription from 'getsentry/hooks/useSubscription';
import {BillingType} from 'getsentry/types';
import {getPotentialProductTrial} from 'getsentry/utils/billing';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';

type AiSetupDataConsentProps = {
  groupId: string;
};

function AiSetupDataConsent({groupId}: AiSetupDataConsentProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {data: autofixSetupData, hasAutofixQuota, refetch} = useAutofixSetup({groupId});
  const navigate = useNavigate();
  const subscription = useSubscription();

  const trial = getPotentialProductTrial(
    subscription?.productTrials ?? null,
    DataCategory.SEER_AUTOFIX
  );

  const orgHasAcknowledged = autofixSetupData?.setupAcknowledgement.orgHasAcknowledged;
  const shouldShowBilling =
    organization.features.includes('seer-billing') && !hasAutofixQuota;
  const canStartTrial = Boolean(trial && !trial.isStarted);
  const hasSeerButNeedsPayg =
    shouldShowBilling && organization.features.includes('seer-added');

  const isTouchCustomer = subscription?.type === BillingType.INVOICED;
  const isSponsoredCustomer = Boolean(subscription?.isSponsored);

  const userHasBillingAccess = organization.access.includes('org:billing');

  const autofixAcknowledgeMutation = useMutation({
    mutationFn: () => {
      return promptsUpdate(api, {
        organization,
        feature: 'seer_autofix_setup_acknowledged',
        status: 'dismissed',
      });
    },
    onSuccess: () => {
      // Make sure this query key doesn't go out of date with the one on the Sentry side!
      queryClient.invalidateQueries({
        queryKey: [
          `/organizations/${organization.slug}/issues/${groupId}/autofix/setup/`,
        ],
      });
    },
  });

  function handlePurchaseSeer() {
    navigate(`/settings/billing/checkout/?referrer=manage_subscription`);
  }

  function handleAddBudget() {
    if (!subscription) {
      return;
    }
    openOnDemandBudgetEditModal({
      organization,
      subscription,
    });
  }

  return (
    <ConsentItemsContainer>
      <Flex align="center" gap={space(1)}>
        <SayHelloHeader>{t('Say Hello to a Smarter Sentry')}</SayHelloHeader>
      </Flex>
      <Flex align="center" justify="center" gap={space(1)}>
        <img src={autofixSetupImg} alt="Seer looking at a root cause for a solution" />
      </Flex>
      <SingleCard>
        <Flex align="center" gap={space(1)}>
          <MeetSeerHeader>MEET SEER</MeetSeerHeader>
          <StyledSeerWaitingIcon size="lg" />
        </Flex>
        <Paragraph>
          {t(
            "Seer is Sentry's AI agent that helps you troubleshoot and fix problems with your applications, including bugs and performance issues. Seer includes:"
          )}
        </Paragraph>
        <BulletList>
          <li>{t('Issue Triage')}</li>
          <li>{t('Root Cause Analysis')}</li>
          <li>{t('Solutions & Code Changes')}</li>
        </BulletList>
        {shouldShowBilling ? (
          isTouchCustomer || isSponsoredCustomer ? (
            <TouchCustomerMessage>
              {isTouchCustomer
                ? tct(
                    'Contact your customer success manager to get access to Seer.[break]Send us an [link:email] if you need help.',
                    {
                      link: <ExternalLink href="mailto:sales@sentry.io" />,
                      break: <br />,
                    }
                  )
                : tct(
                    'Seer is not available on Sponsored plans.[break]Send us an [link:email] if you need help.',
                    {
                      link: <ExternalLink href="mailto:support@sentry.io" />,
                      break: <br />,
                    }
                  )}
            </TouchCustomerMessage>
          ) : (
            <Fragment>
              <ButtonWrapper>
                {canStartTrial ? (
                  <StartTrialButton
                    organization={organization}
                    source="ai-setup-consent"
                    requestData={{
                      productTrial: {
                        category: DataCategory.SEER_AUTOFIX,
                        reasonCode: trial?.reasonCode,
                      },
                    }}
                    busy={autofixAcknowledgeMutation.isPending}
                    handleClick={() => autofixAcknowledgeMutation.mutate()}
                    size="md"
                    priority="primary"
                    analyticsEventKey="seer_drawer.free_trial_clicked"
                    analyticsEventName="Seer Drawer: Clicked Free Trial"
                  >
                    {t('Try Seer for Free')}
                  </StartTrialButton>
                ) : hasSeerButNeedsPayg ? (
                  <Flex gap={space(2)} column>
                    <ErrorText>
                      {tct(
                        "You've run out of [budgetTerm] budget. Please add more to keep using Seer.",
                        {
                          budgetTerm: subscription?.planDetails.budgetTerm,
                        }
                      )}
                    </ErrorText>
                    <Flex>
                      <AddBudgetButton
                        priority="primary"
                        onClick={() => {
                          handleAddBudget();
                          autofixAcknowledgeMutation.mutate();
                        }}
                        size="md"
                        disabled={!userHasBillingAccess}
                        title={
                          userHasBillingAccess
                            ? undefined
                            : t(
                                "You don't have access to manage billing. Contact a billing admin for your org."
                              )
                        }
                        analyticsEventKey="seer_drawer.add_budget_clicked"
                        analyticsEventName="Seer Drawer: Clicked Add Budget"
                      >
                        {t('Add Budget')}
                      </AddBudgetButton>
                      <Button
                        icon={<IconRefresh size="xs" />}
                        onClick={() => refetch()}
                        size="md"
                        priority="default"
                        aria-label={t('Refresh')}
                        borderless
                      />
                    </Flex>
                  </Flex>
                ) : (
                  <Button
                    priority="primary"
                    onClick={() => {
                      autofixAcknowledgeMutation.mutate();
                      handlePurchaseSeer();
                    }}
                    disabled={autofixAcknowledgeMutation.isPending}
                    size="md"
                    analyticsEventKey="seer_drawer.checkout_clicked"
                    analyticsEventName="Seer Drawer: Clicked Checkout"
                  >
                    {autofixAcknowledgeMutation.isPending ? (
                      <StyledLoadingIndicator size={14} />
                    ) : (
                      t('Purchase Seer')
                    )}
                  </Button>
                )}
                {autofixAcknowledgeMutation.isError && (
                  <ErrorText>{t('Something went wrong.')}</ErrorText>
                )}
              </ButtonWrapper>
              {canStartTrial && (
                <LegalText>
                  {t(
                    'By clicking above, you will begin a 14 day free trial. After the trial ends, it will not auto-renew.'
                  )}
                </LegalText>
              )}
            </Fragment>
          )
        ) : (
          <Fragment>
            <ButtonWrapper>
              <Button
                priority="primary"
                onClick={() => autofixAcknowledgeMutation.mutate()}
                disabled={autofixAcknowledgeMutation.isPending}
                analyticsEventKey="gen_ai_consent.in_drawer_clicked"
                analyticsEventName="Gen AI Consent: Clicked In Drawer"
                analyticsParams={{
                  is_first_user_in_org: !orgHasAcknowledged,
                }}
                size="md"
              >
                {autofixAcknowledgeMutation.isPending ? (
                  <StyledLoadingIndicator size={14} />
                ) : orgHasAcknowledged ? (
                  t('Try Seer')
                ) : (
                  t('Enable Seer')
                )}
              </Button>
              {autofixAcknowledgeMutation.isError && (
                <ErrorText>{t('Something went wrong.')}</ErrorText>
              )}
            </ButtonWrapper>
          </Fragment>
        )}
        {!orgHasAcknowledged && (
          <LegalText>
            {tct(
              'Seer models are powered by generative AI. Per our [dataLink:data usage policies], Sentry does not share AI-generated output from your data with other customers or use your data to train generative AI models without your express consent.',
              {
                dataLink: (
                  <ExternalLink href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-identifying-data-for-generative-ai-features" />
                ),
              }
            )}
          </LegalText>
        )}
      </SingleCard>
    </ConsentItemsContainer>
  );
}

export default AiSetupDataConsent;

const ConsentItemsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const SayHelloHeader = styled('h3')`
  margin: 0;
`;

const SingleCard = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  background-color: ${p => p.theme.background};
  padding: ${space(2)} ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  margin-top: ${space(2)};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const MeetSeerHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const StyledSeerWaitingIcon = styled(SeerWaitingIcon)`
  color: ${p => p.theme.subText};
`;

const BulletList = styled('ul')`
  margin: 0 0 ${space(1)} 0;
`;

const Paragraph = styled('p')`
  margin: 0;
`;

const TouchCustomerMessage = styled('p')`
  color: ${p => p.theme.pink400};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-top: ${space(2)};
`;

const LegalText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(1)};
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

const AddBudgetButton = styled(Button)`
  width: fit-content;
`;
