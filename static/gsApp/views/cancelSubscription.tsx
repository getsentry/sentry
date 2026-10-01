import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import {ANNUAL} from 'getsentry/constants';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

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
    [
      getApiUrl('/customers/$organizationIdOrSlug/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: 0}
  );
  const [state, setState] = useState<State>({
    canSubmit: false,
    showFollowup: false,
    understandsMembers: false,
    val: null,
    checkboxes: {},
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {reason: '', followup: ''},
    onSubmit: ({value}) => handleSubmit(value),
  });

  const handleSubmitSuccess = (resp: any) => {
    SubscriptionStore.loadData(organization.slug);
    const msg = resp?.responseJSON?.details || t('Successfully cancelled subscription');

    addSuccessMessage(msg);
    navigate({
      pathname: normalizeUrl(`/settings/${organization.slug}/billing/`),
    });
  };

  const handleSubmit = async (data: {followup: string; reason: string}) => {
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
        <Alert variant="danger">{t('Your plan is not eligible to be cancelled.')}</Alert>
      </Alert.Container>
    );
  }

  if (subscription.usedLicenses > 1 && !state.understandsMembers) {
    return (
      <Fragment>
        <Alert.Container>
          <Alert variant="danger">
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
          variant="danger"
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
        <Alert variant="warning">
          {tct(
            `Your organization is currently subscribed to the [planName] plan on a [interval] contract.
             Cancelling your subscription will downgrade your account to a free plan at the end
             of your contract on [contractEndDate].`,
            {
              interval: subscription?.billingInterval === ANNUAL ? 'annual' : 'monthly',
              planName: <strong>{subscription?.planDetails?.name}</strong>,
              contractEndDate: (
                <strong>{moment(subscription.billingPeriodEnd).format('ll')}</strong>
              ),
            }
          )}
        </Alert>
      </Alert.Container>

      <Panel>
        <PanelHeader>{t('Cancellation Reason')}</PanelHeader>

        <PanelBody withPadding>
          <form.AppForm form={form}>
            <TextBlock>
              {t('Please help us understand why you are cancelling:')}
            </TextBlock>

            <form.AppField name="reason">
              {field => (
                <field.Layout.Stack label={t('Reason')}>
                  <field.Radio.Group
                    value={field.state.value}
                    onChange={val => {
                      field.handleChange(val);
                      form.setFieldValue('followup', '');
                      setState(currentState => ({
                        ...currentState,
                        canSubmit: true,
                        showFollowup: true,
                        checkboxes: {},
                        val,
                      }));
                    }}
                  >
                    {CANCEL_STEPS.map(cancel => (
                      <field.Radio.Item key={cancel.reason[0]} value={cancel.reason[0]}>
                        <RadioContainer>
                          {cancel.reason[1]}
                          {cancel.checkboxes &&
                            state.val === cancel.reason[0] &&
                            cancel.checkboxes.map(([name, label]) => (
                              <ExtraContainer key={name}>
                                <Checkbox
                                  data-test-id={`checkbox-${name}`}
                                  checked={state.checkboxes[name]}
                                  name={name}
                                  onChange={event => {
                                    setState(currentState => ({
                                      ...currentState,
                                      checkboxes: {
                                        ...currentState.checkboxes,
                                        [name]: event.target.checked,
                                      },
                                    }));
                                  }}
                                />
                                {label}
                              </ExtraContainer>
                            ))}
                        </RadioContainer>
                      </field.Radio.Item>
                    ))}
                  </field.Radio.Group>
                </field.Layout.Stack>
              )}
            </form.AppField>
            {state.showFollowup && (
              <form.AppField name="followup">
                {field => (
                  <field.Layout.Stack label={followup}>
                    <field.TextArea
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            )}

            <ButtonList>
              <form.SubmitButton variant="danger" disabled={!state.canSubmit}>
                {t('Cancel Subscription')}
              </form.SubmitButton>
              <Button
                onClick={() => {
                  navigate(normalizeUrl(`/settings/${organization.slug}/billing/`));
                }}
              >
                {t('Never Mind')}
              </Button>
            </ButtonList>
          </form.AppForm>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.md};
`;

function CancelSubscriptionPage() {
  const title = t('Cancel Subscription');
  return (
    <SubscriptionPageContainer data-test-id="cancel-subscription">
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

const ExtraContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} 0;
`;

export default CancelSubscriptionPage;
