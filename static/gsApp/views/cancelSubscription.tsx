import {Fragment, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

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

const cancellationSchema = z.object({
  reason: z.string().min(1, t('Select a reason for cancelling')),
  followup: z.string(),
});

function CancelSubscriptionForm() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {data: subscription, isPending} = useQuery(
    apiOptions.as<Subscription>()('/customers/$organizationIdOrSlug/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    })
  );
  const [selectedReason, setSelectedReason] = useState<CancelReason[0] | null>(null);
  const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>({});
  const [understandsMembers, setUnderstandsMembers] = useState(false);
  const mutation = useMutation({
    mutationFn: (data: {checkboxes: string[]; followup: string; reason: string}) =>
      fetchMutation<{details?: string}>({
        url: getApiUrl('/customers/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: subscription?.slug ?? organization.slug},
        }),
        method: 'DELETE',
        data,
      }),
    onSuccess: resp => {
      SubscriptionStore.loadData(organization.slug);
      const msg = resp.details || t('Successfully cancelled subscription');

      addSuccessMessage(msg);
      navigate({
        pathname: normalizeUrl(`/settings/${organization.slug}/billing/`),
      });
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(
        typeof detail === 'string' ? detail : t('Failed to cancel subscription')
      );
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {reason: '', followup: ''},
    validators: {onDynamic: cancellationSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync({
          ...value,
          checkboxes: Object.keys(checkboxes).filter(key => checkboxes[key]),
        })
        .catch(() => {}),
  });

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

  if (subscription.usedLicenses > 1 && !understandsMembers) {
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
        <Button variant="danger" onClick={() => setUnderstandsMembers(true)}>
          {t('I understand')}
        </Button>
      </Fragment>
    );
  }

  const followup = CANCEL_STEPS.find(
    cancel => cancel.reason[0] === selectedReason
  )?.followup;

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

        <PanelBody>
          <form.AppForm form={form}>
            <Stack gap="xl" padding="xl" paddingBottom="2xl">
              <Text as="span">
                {t('Please help us understand why you are cancelling')}
              </Text>
              <form.AppField name="reason">
                {field => (
                  <Container width="fit-content" maxWidth="100%">
                    <field.Radio.Group
                      align="start"
                      value={field.state.value}
                      onChange={val => {
                        field.handleChange(val);
                        form.setFieldValue('followup', '');
                        setCheckboxes({});
                        setSelectedReason(val);
                      }}
                    >
                      <field.Layout.Stack required label={t('Reason')}>
                        <Stack gap="sm">
                          {CANCEL_STEPS.map(cancel => (
                            <field.Radio.Item
                              key={cancel.reason[0]}
                              value={cancel.reason[0]}
                            >
                              <Stack>
                                {cancel.reason[1]}
                                {cancel.checkboxes &&
                                  selectedReason === cancel.reason[0] &&
                                  cancel.checkboxes.map(([name, label]) => (
                                    <Flex
                                      key={name}
                                      align="center"
                                      gap="md"
                                      padding="md 0"
                                    >
                                      <Checkbox
                                        data-test-id={`checkbox-${name}`}
                                        checked={checkboxes[name]}
                                        name={name}
                                        onChange={event => {
                                          setCheckboxes(currentCheckboxes => ({
                                            ...currentCheckboxes,
                                            [name]: event.target.checked,
                                          }));
                                        }}
                                      />
                                      {label}
                                    </Flex>
                                  ))}
                              </Stack>
                            </field.Radio.Item>
                          ))}
                        </Stack>
                      </field.Layout.Stack>
                    </field.Radio.Group>
                  </Container>
                )}
              </form.AppField>
              {selectedReason && (
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
            </Stack>

            <Flex gap="md" justify="end" padding="2xl xl" borderTop="primary">
              <Button
                onClick={() => {
                  navigate(normalizeUrl(`/settings/${organization.slug}/billing/`));
                }}
              >
                {t('Never Mind')}
              </Button>
              <form.SubmitButton variant="danger">
                {t('Cancel Subscription')}
              </form.SubmitButton>
            </Flex>
          </form.AppForm>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

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

export default CancelSubscriptionPage;
