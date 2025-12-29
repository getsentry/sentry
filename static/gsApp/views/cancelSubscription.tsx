import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {ExternalLink} from 'sentry/components/core/link';
import RadioGroupField from 'sentry/components/forms/fields/radioField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import withSubscription from 'getsentry/components/withSubscription';
import {ANNUAL} from 'getsentry/constants';
import subscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {checkForPromptBasedPromotion} from 'getsentry/utils/promotionUtils';
import usePromotionTriggerCheck from 'getsentry/utils/usePromotionTriggerCheck';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

type CancelReason = [string, React.ReactNode];
type CancelCheckbox = [string, React.ReactNode];

const CANCEL_STEPS: Array<{
  followup: React.ReactNode;
  reason: CancelReason;
  checkboxes?: CancelCheckbox[];
}> = [
  {
    reason: ['migration', t('Consolidating Sentry accounts.')],
    followup: t(
      'If migrating to another existing account, can you provide the org slug?'
    ),
  },
  {
    reason: ['competitor', t('We are switching to a different solution.')],
    followup: t("Care to share the solution you've chosen and why?"),
  },
  {
    reason: ['not_a_fit', t("Sentry doesn't fit our needs.")],
    followup: t('Give us more feedback?'),
    checkboxes: [
      [
        'reach_out',
        t(
          "Prefer to share feedback live? Let us know what you'd like to discuss and we'll have a Product Manager reach out!"
        ),
      ],
    ],
  },
  {
    reason: ['pricing_expensive', t('Pricing is too expensive.')],
    followup: t('Anything more we should know?'),
  },
  {
    reason: ['pricing_value', t("I didn't get the value I wanted.")],
    followup: t('What was missing?'),
  },
  {
    reason: ['only_need_free', t('We only need the free plan.')],
    followup: t('Fair enough. Anything more we should know?'),
    checkboxes: [
      ['features', t("I don't need so much volume.")],
      ['volume', t('Developer features are enough for me.')],
    ],
  },
  {
    reason: ['self_hosted', t('We are hosting Sentry ourselves.')],
    followup: t('Are you interested in a single tenant version of Sentry?'),
  },
  {
    reason: ['shutting_down', t('The project/product/company is shutting down.')],
    followup: t('Sorry to hear that! Anything more we should know?'),
  },
];

type State = {
  canSubmit: boolean;
  checkboxes: Record<string, boolean>;
  showFollowup: boolean;
  understandsMembers: boolean;
  val: CancelReason[0] | null;
};

function CancelSubscriptionForm() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const api = useApi();
  const {data: subscription, isPending} = useApiQuery<Subscription>(
    [`/customers/${organization.slug}/`],
    {staleTime: 0}
  );
  const [state, setState] = useState<State>({
    canSubmit: false,
    showFollowup: false,
    understandsMembers: false,
    val: null,
    checkboxes: {},
  });

  const handleSubmitSuccess = (resp: any) => {
    subscriptionStore.loadData(organization.slug);
    const msg = resp?.responseJSON?.details || t('Successfully cancelled subscription');

    addSuccessMessage(msg);
    navigate({
      pathname: normalizeUrl(`/settings/${organization.slug}/billing/`),
    });
  };

  const handleSubmit = async (data: any) => {
    try {
      const submitData = {
        ...data,
        checkboxes: Object.keys(state.checkboxes).filter(key => state.checkboxes[key]),
      };

      const response = await api.requestPromise(`/customers/${subscription?.slug}/`, {
        method: 'DELETE',
        data: submitData,
      });

      handleSubmitSuccess(response);
    } catch (error: any) {
      addErrorMessage(error.responseJSON?.detail || t('Failed to cancel subscription'));
    }
  };

  if (isPending || !subscription) {
    return <LoadingIndicator />;
  }

  const canCancelPlan = subscription.canSelfServe && subscription.canCancel;

  if (!canCancelPlan) {
    return (
      <Alert.Container>
        <Alert type="danger">{t('Your plan is not eligible to be cancelled.')}</Alert>
      </Alert.Container>
    );
  }

  if (subscription.usedLicenses > 1 && !state.understandsMembers) {
    return (
      <Fragment>
        <Alert.Container>
          <Alert type="danger">
            {tct(
              `Upon cancellation your account will be downgraded to a free plan which is limited to a single user.
            Your account currently has [count] [teamMembers: other team member(s)] using Sentry that would lose
            access upon cancelling your subscription.`,
              {
                count: <strong>{subscription.usedLicenses - 1}</strong>,
                teamMembers: <strong />,
              }
            )}
          </Alert>
        </Alert.Container>
        <Button
          priority="danger"
          onClick={() =>
            setState(currentState => ({...currentState, understandsMembers: true}))
          }
        >
          {t('I understand')}
        </Button>
      </Fragment>
    );
  }

  const followup = CANCEL_STEPS.find(cancel => cancel.reason[0] === state.val)?.followup;

  return (
    <Fragment>
      <Alert.Container>
        <Alert type="warning">
          {tct(
            `Your organization is currently subscribed to the [planName] plan on a [interval] contract.
             Cancelling your subscription will downgrade your account to a free plan at the end
             of your contract on [contractEndDate]. See [changesLink:upcoming changes] to our free Developer plan.`,
            {
              interval: subscription?.contractInterval === ANNUAL ? 'annual' : 'monthly',
              planName: <strong>{subscription?.planDetails?.name}</strong>,
              contractEndDate: (
                <strong>{moment(subscription.contractPeriodEnd).format('ll')}</strong>
              ),
              changesLink: (
                <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26206897429275-Changes-to-our-Developer-plan" />
              ),
            }
          )}
        </Alert>
      </Alert.Container>

      <Panel>
        <PanelHeader>{t('Cancellation Reason')}</PanelHeader>

        <PanelBody withPadding>
          <Form onSubmit={handleSubmit} onSubmitSuccess={handleSubmitSuccess} hideFooter>
            <TextBlock>
              {t('Please help us understand why you are cancelling:')}
            </TextBlock>

            <RadioGroupContainer
              stacked
              name="reason"
              label=""
              inline={false}
              choices={CANCEL_STEPS.map<CancelReason>(cancel => [
                cancel.reason[0],
                <RadioContainer key={cancel.reason[0]}>
                  {cancel.reason[1]}
                  {cancel.checkboxes && state.val === cancel.reason[0] && (
                    <Fragment>
                      {cancel.checkboxes.map(([name, label]) => (
                        <ExtraContainer key={name}>
                          <Checkbox
                            data-test-id={`checkbox-${name}`}
                            checked={state.checkboxes[name]}
                            name={name}
                            onChange={(value: any) => {
                              setState(currentState => ({
                                ...currentState,
                                checkboxes: {
                                  ...currentState.checkboxes,
                                  [name]: value.target.checked,
                                },
                              }));
                            }}
                          />
                          {label}
                        </ExtraContainer>
                      ))}
                    </Fragment>
                  )}
                </RadioContainer>,
              ])}
              onChange={(val: any) =>
                setState(currentState => ({
                  ...currentState,
                  canSubmit: true,
                  showFollowup: true,
                  checkboxes: {},
                  val,
                }))
              }
            />
            {state.showFollowup && (
              <TextareaField stacked label={followup} name="followup" inline={false} />
            )}

            <ButtonList>
              <Button type="submit" priority="danger" disabled={!state.canSubmit}>
                {t('Cancel Subscription')}
              </Button>
              <Button
                onClick={() => {
                  browserHistory.push(
                    normalizeUrl(`/settings/${organization.slug}/billing/`)
                  );
                }}
              >
                {t('Never Mind')}
              </Button>
            </ButtonList>
          </Form>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

interface CancelSubscriptionWrapperProps {
  subscription: Subscription;
}

function CancelSubscriptionWrapper({subscription}: CancelSubscriptionWrapperProps) {
  const api = useApi();
  const organization = useOrganization();
  const navigate = useNavigate();
  const {refetch, data: promotionData} = usePromotionTriggerCheck(organization);
  const switchToBillingOverview = useCallback(() => {
    navigate(
      normalizeUrl({
        pathname: `/settings/${organization.slug}/billing/overview/`,
      })
    );
  }, [navigate, organization.slug]);
  useEffect(() => {
    // when we mount, we know someone is thinking about canceling their subscription
    if (promotionData) {
      checkForPromptBasedPromotion({
        organization,
        onRefetch: refetch,
        promptFeature: 'cancel_subscription',
        subscription,
        promotionData,
        onAcceptConditions: switchToBillingOverview,
      });
    }
  }, [api, organization, refetch, subscription, promotionData, switchToBillingOverview]);

  const title = t('Cancel Subscription');
  return (
    <SubscriptionPageContainer
      background="secondary"
      organization={organization}
      dataTestId="cancel-subscription"
    >
      <SentryDocumentTitle title={title} />
      <SettingsPageHeader title={title} />
      <CancelSubscriptionForm />
    </SubscriptionPageContainer>
  );
}

const RadioContainer = styled('div')`
  display: flex;
  flex-direction: column;

  label {
    grid-template-columns: max-content 1fr;
    grid-template-rows: auto auto;

    > div:last-child {
      grid-column: 2;
    }
  }
`;

const RadioGroupContainer = styled(RadioGroupField)`
  label {
    align-items: flex-start;
  }
`;

const ExtraContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1)} 0;
`;

export default withSubscription(CancelSubscriptionWrapper, {
  noLoader: true,
});
