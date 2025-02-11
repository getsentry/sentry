import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import RadioGroupField from 'sentry/components/forms/fields/radioField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
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
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import withSubscription from 'getsentry/components/withSubscription';
import {ANNUAL} from 'getsentry/constants';
import type {PromotionData, Subscription} from 'getsentry/types';
import {checkForPromptBasedPromotion} from 'getsentry/utils/promotionUtils';
import usePromotionTriggerCheck from 'getsentry/utils/usePromotionTriggerCheck';
import withPromotions from 'getsentry/utils/withPromotions';

type CancelReason = [string, React.ReactNode];

const CANCEL_STEPS: {followup: React.ReactNode; reason: CancelReason}[] = [
  {
    reason: ['shutting_down', t('The project/product/company is shutting down.')],
    followup: t('Sorry to hear that! Anything more we should know?'),
  },
  {
    reason: ['only_need_free', t('We only need the features on the free plan.')],
    followup: t(
      'Fair enough. Which features on the free plan are most important to you?'
    ),
  },
  {
    reason: ['not_a_fit', t("Sentry doesn't fit our needs.")],
    followup: t('Bummer. What features were missing for you?'),
  },
  {
    reason: ['competitor', t('We are switching to a different solution.')],
    followup: t('Thanks for letting us know. Which solution(s)? Why?'),
  },
  {
    reason: ['pricing', t("The pricing doesn't fit our needs.")],
    followup: t("What about it wasn't right for you?"),
  },
  {
    reason: ['self_hosted', t('We are hosting Sentry ourselves.')],
    followup: t('Are you interested in a single tenant version of Sentry?'),
  },
  {
    reason: ['no_more_errors', t('We no longer get any errors.')],
    followup: t("Congrats! What's your secret?"),
  },
  {
    reason: ['other', t('Other')],
    followup: t('Other reason?'),
  },
];

type State = {
  canSubmit: boolean;
  showFollowup: boolean;
  understandsMembers: boolean;
  val: CancelReason[0] | null;
};

function CancelSubscriptionForm() {
  const organization = useOrganization();
  const {data: subscription, isPending} = useApiQuery<Subscription>(
    [`/customers/${organization.slug}/`],
    {staleTime: 0}
  );
  const [state, setState] = useState<State>({
    canSubmit: false,
    showFollowup: false,
    understandsMembers: false,
    val: null,
  });

  if (isPending || !subscription) {
    return <LoadingIndicator />;
  }

  const canCancelPlan = subscription.canSelfServe && subscription.canCancel;

  if (!canCancelPlan) {
    return (
      <Alert type="error" showIcon>
        {t('Your plan is not eligible to be cancelled.')}
      </Alert>
    );
  }

  if (subscription.usedLicenses > 1 && !state.understandsMembers) {
    return (
      <Fragment>
        <Alert type="error" showIcon>
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

  const handleSubmitSuccess = (resp: any) => {
    const msg = resp?.responseJSON?.details || t('Successfully cancelled subscription');

    addSuccessMessage(msg);
    browserHistory.push(normalizeUrl(`/settings/${organization.slug}/billing/`));
  };

  return (
    <Fragment>
      <Alert type="warning" showIcon>
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

      <Panel>
        <PanelHeader>{t('Cancellation Reason')}</PanelHeader>

        <PanelBody withPadding>
          <Form
            apiMethod="DELETE"
            apiEndpoint={`/customers/${subscription.slug}/`}
            onSubmitSuccess={handleSubmitSuccess}
            hideFooter
          >
            <TextBlock>
              {t('Please help us understand why you are cancelling:')}
            </TextBlock>

            <RadioGroupField
              stacked
              name="reason"
              label=""
              inline={false}
              choices={CANCEL_STEPS.map<CancelReason>(cancel => cancel.reason)}
              onChange={(val: any) =>
                setState(currentState => ({
                  ...currentState,
                  canSubmit: true,
                  showFollowup: true,
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
  promotionData?: PromotionData;
}

function CancelSubscriptionWrapper({
  promotionData,
  subscription,
}: CancelSubscriptionWrapperProps) {
  const api = useApi();
  const organization = useOrganization();
  const {refetch} = usePromotionTriggerCheck(organization);
  const switchToBillingOverview = () =>
    browserHistory.push('/settings/billing/overview/');
  useEffect(() => {
    // when we mount, we know someone is thinking about canceling their subscription
    promotionData &&
      checkForPromptBasedPromotion({
        organization,
        refetch,
        promptFeature: 'cancel_subscription',
        subscription,
        promotionData,
        onAcceptConditions: switchToBillingOverview,
      });
  }, [api, organization, refetch, subscription, promotionData]);

  const title = t('Cancel Subscription');
  return (
    <div data-test-id="cancel-subscription">
      <SentryDocumentTitle title={title} />
      <SettingsPageHeader title={title} />
      <CancelSubscriptionForm />
    </div>
  );
}

export default withSubscription(withPromotions(CancelSubscriptionWrapper), {
  noLoader: true,
});
