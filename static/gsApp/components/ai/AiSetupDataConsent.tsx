import {Fragment} from 'react';
import styled from '@emotion/styled';

import autofixSetupImg from 'sentry-images/features/autofix-setup.svg';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {AiPrivacyNotice} from 'sentry/components/aiPrivacyTooltip';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {useSeerAcknowledgeMutation} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconRefresh, IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {sendAddEventsRequest} from 'getsentry/actionCreators/upsell';
import type {EventType} from 'getsentry/components/addEventsCTA';
import StartTrialButton from 'getsentry/components/startTrialButton';
import useSubscription from 'getsentry/hooks/useSubscription';
import {BillingType, OnDemandBudgetMode} from 'getsentry/types';
import {getPotentialProductTrial, getSeerTrialCategory} from 'getsentry/utils/billing';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';

type AiSetupDataConsentProps = {
  groupId?: string;
};

function AiSetupDataConsent({groupId}: AiSetupDataConsentProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const navigate = useNavigate();
  const subscription = useSubscription();

  // Use group-specific setup if groupId is provided, otherwise use organization setup
  const groupSetup = useAutofixSetup({groupId: groupId!}, {enabled: Boolean(groupId)});
  const orgSetup = useOrganizationSeerSetup({enabled: !groupId});

  // Determine which data to use based on whether groupId is provided
  const isGroupMode = Boolean(groupId);
  const setupData = isGroupMode ? groupSetup.data : null;
  const hasAutofixQuota = isGroupMode
    ? groupSetup.hasAutofixQuota
    : orgSetup.billing.hasAutofixQuota;
  const orgHasAcknowledged = isGroupMode
    ? setupData?.setupAcknowledgement.orgHasAcknowledged
    : orgSetup.setupAcknowledgement.orgHasAcknowledged;
  const refetch = isGroupMode ? groupSetup.refetch : orgSetup.refetch;

  // Get the appropriate Seer category (SEER_USER for seat-based, SEER_AUTOFIX for legacy)
  const seerCategory = getSeerTrialCategory(subscription?.productTrials ?? null);
  const trial = seerCategory
    ? getPotentialProductTrial(subscription?.productTrials ?? null, seerCategory)
    : null;

  const shouldShowBilling =
    organization.features.includes('seer-billing') && !hasAutofixQuota;
  const canStartTrial = Boolean(trial && !trial.isStarted);
  const hasSeerButNeedsPayg =
    shouldShowBilling && organization.features.includes('seer-added');

  const isTouchCustomer = subscription?.type === BillingType.INVOICED;
  const isSponsoredCustomer = Boolean(subscription?.isSponsored);

  const isPerCategoryOnDemand =
    subscription?.onDemandBudgets?.budgetMode === OnDemandBudgetMode.PER_CATEGORY;

  const userHasBillingAccess = organization.access.includes('org:billing');

  const warnAboutGithubIntegration =
    isGroupMode &&
    !setupData?.integration.ok &&
    shouldShowBilling &&
    !isTouchCustomer &&
    !hasSeerButNeedsPayg;

  const autofixAcknowledgeMutation = useSeerAcknowledgeMutation();

  function handlePurchaseSeer() {
    navigate('/checkout/?referrer=ai_setup_data_consent');
  }

  function handleAddBudget() {
    if (!subscription) {
      return;
    }
    if (isPerCategoryOnDemand) {
      // Seer does not support per category on demand budgets, so we need to redirect to the checkout page to prompt the user to switch
      navigate('/checkout/?referrer=ai_setup_data_consent#step2');
      return;
    }
    openOnDemandBudgetEditModal({
      organization,
      subscription,
    });
  }

  return (
    <ConsentItemsContainer>
      <Flex align="center" gap="md">
        <SayHelloHeader>{t('Say Hello to a Smarter Sentry')}</SayHelloHeader>
      </Flex>
      <Flex align="center" justify="center" gap="md">
        <img src={autofixSetupImg} alt="Seer looking at a root cause for a solution" />
      </Flex>
      <SingleCard>
        <Flex align="center" gap="md">
          <MeetSeerHeader>MEET SEER</MeetSeerHeader>
          <IconSeer animation="waiting" color="subText" size="lg" />
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
                        category: trial?.category,
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
                  <Flex gap="xl" direction="column">
                    <ErrorText>
                      {tct(
                        "You've run out of [budgetTerm] budget. Please add more to keep using Seer.",
                        {
                          budgetTerm: subscription?.planDetails.budgetTerm,
                        }
                      )}
                    </ErrorText>
                    <Flex>
                      {userHasBillingAccess ? (
                        <AddBudgetButton
                          priority="primary"
                          onClick={() => {
                            handleAddBudget();
                            autofixAcknowledgeMutation.mutate();
                          }}
                          size="md"
                          analyticsEventKey="seer_drawer.add_budget_clicked"
                          analyticsEventName="Seer Drawer: Clicked Add Budget"
                        >
                          {t('Add Budget')}
                        </AddBudgetButton>
                      ) : (
                        <Button
                          priority="primary"
                          onClick={async () => {
                            await sendAddEventsRequest({
                              api,
                              organization,
                              eventTypes: [
                                DATA_CATEGORY_INFO.seer_autofix.singular as EventType,
                              ],
                            });
                            autofixAcknowledgeMutation.mutate();
                          }}
                          size="md"
                          analyticsEventKey="seer_drawer.request_budget_clicked"
                          analyticsEventName="Seer Drawer: Clicked Request Budget"
                        >
                          {t('Request Budget')}
                        </Button>
                      )}
                      <Button
                        icon={<IconRefresh size="xs" />}
                        onClick={async () => {
                          await refetch();
                          addSuccessMessage(t('Refreshed Seer quota'));
                        }}
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
        <LegalText>
          <AiPrivacyNotice />
        </LegalText>
      </SingleCard>
      {warnAboutGithubIntegration && (
        <Alert variant="warning" showIcon={false}>
          {t(
            'Seer currently works best with GitHub repositories, but support for other providers is coming soon. Either way, you can still use Seer to triage and dive into issues.'
          )}
        </Alert>
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

const SayHelloHeader = styled('h3')`
  margin: 0;
`;

const SingleCard = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${space(2)} ${space(2)};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.border};
  margin-top: ${space(2)};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const MeetSeerHeader = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
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
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-top: ${space(2)};
`;

const LegalText = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
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
