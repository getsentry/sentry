import {useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import withApi from 'sentry/utils/withApi';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import type {PreviewData, Subscription} from 'getsentry/types';
import {InvoiceItemType} from 'getsentry/types';
import {loadStripe} from 'getsentry/utils/stripe';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {StepPropsWithApi} from 'getsentry/views/amCheckout/types';
import type {IntentDetails} from 'getsentry/views/amCheckout/utils';
import {
  displayPrice,
  fetchPreviewData,
  stripeHandleCardAction,
  submitCheckout,
} from 'getsentry/views/amCheckout/utils';

type State = {
  cardActionError: string | null;
  loadError: Error | null;
  loading: boolean;
  previewData: PreviewData | null;
  submitting: boolean;
};

function formatDate(date: string) {
  return moment(date).format('ll');
}

function ReviewAndConfirm({
  api,
  formData,
  isActive,
  isCompleted,
  onEdit,
  organization,
  prevStepCompleted,
  stepNumber,
  subscription,
  referrer,
}: StepPropsWithApi) {
  const [state, setState] = useState<State>({
    cardActionError: null,
    loadError: null,
    loading: true,
    previewData: null,
    submitting: false,
  });
  const title = t('Review & Confirm');
  const [stripe, setStripe] = useState<stripe.Stripe>();
  const hasPartnerMigrationFeature = organization.features.includes(
    'partner-billing-migration'
  );

  const fetchPreview = useCallback(async () => {
    await fetchPreviewData(
      organization,
      api,
      formData,
      () =>
        setState(current => ({
          ...current,
          loading: true,
          loadError: null,
          previewData: null,
        })),
      (previewData: any) =>
        setState(current => ({
          ...current,
          loading: false,
          loadError: null,
          cardActionError: null,
          previewData,
        })),
      (error: any) =>
        setState(current => ({...current, loadError: error, loading: false}))
    );
  }, [api, formData, organization]);

  useEffect(() => {
    // the billing interval can be changed in the checkout overview
    // while this step is active so update both on opening the step and
    // changing any form data while the step is active
    if (isActive) {
      fetchPreview();
    }
  }, [isActive, formData, fetchPreview]);

  useEffect(() => {
    loadStripe(Stripe => {
      const apiKey = ConfigStore.get('getsentry.stripePublishKey');
      const instance = Stripe(apiKey);
      setStripe(instance);
    });
  }, []);

  function handleConfirm(applyNow?: boolean) {
    if (applyNow) {
      formData.applyNow = true;
    }
    setState({...state, submitting: true});
    completeCheckout();
  }

  function handleCardAction(intentDetails: IntentDetails) {
    stripeHandleCardAction(
      intentDetails,
      stripe,
      () => completeCheckout(intentDetails.paymentIntent),
      errorMessage =>
        // @ts-expect-error TS(2322): Type 'string | undefined' is not assignable to typ... Remove this comment to see the full error message
        setState({...state, cardActionError: errorMessage, submitting: false})
    );
  }

  async function completeCheckout(intentId?: string) {
    const {previewData} = state;
    await submitCheckout(
      organization,
      subscription,
      previewData!,
      formData,
      api,
      () => fetchPreview(),
      (intentDetails: any) => handleCardAction(intentDetails),
      (b: any) => setState({...state, submitting: b}),
      intentId,
      referrer
    );
  }

  return (
    <Panel>
      <StepHeader
        canSkip={prevStepCompleted}
        title={title}
        isActive={isActive}
        isCompleted={isCompleted}
        stepNumber={stepNumber}
        onEdit={onEdit}
      />
      {isActive && (
        <StyledPanelBody>
          <ReviewAndConfirmBody
            previewData={state.previewData}
            loading={state.loading}
            loadError={state.loadError}
            cardActionError={state.cardActionError}
            hasPartnerMigrationFeature={hasPartnerMigrationFeature}
            subscription={subscription}
          />
        </StyledPanelBody>
      )}
      {hasPartnerMigrationFeature && isActive && (
        <MigrateNowBody
          handleComplete={handleConfirm}
          submitting={state.submitting}
          previewData={state.previewData}
          cardActionError={state.cardActionError}
        />
      )}
      {isActive && (
        <ReviewAndConfirmFooter
          title={title}
          handleComplete={handleConfirm}
          submitting={state.submitting}
          previewData={state.previewData}
          cardActionError={state.cardActionError}
          hasMigrateNowButton={hasPartnerMigrationFeature}
        />
      )}
    </Panel>
  );
}

function ReviewAndConfirmHeader({
  previewData,
  hasPartnerMigrationFeature,
  subscription,
}: Pick<State, 'previewData'> & {
  hasPartnerMigrationFeature: boolean;
  subscription: Subscription;
}) {
  if (!previewData) {
    return null;
  }

  if (hasPartnerMigrationFeature) {
    return (
      <Header>
        {t('Effective changes')}
        <SubText>
          {tct(
            'These changes will take effect at the end of your current [partnerName] sponsored plan on [newPeriodStart]. If you want these changes to apply immediately, select Migrate Now.',
            {
              partnerName: subscription.partner?.partnership.displayName,
              newPeriodStart: moment(subscription.contractPeriodEnd)
                .add(1, 'days')
                .format('ll'),
            }
          )}
        </SubText>
      </Header>
    );
  }

  const {effectiveAt} = previewData;
  const effectiveNow = new Date(effectiveAt).getTime() <= new Date().getTime() + 3600;

  return (
    <Header>
      {effectiveNow
        ? t('Effective changes as of today')
        : tct('Effective on [date]', {date: <strong>{formatDate(effectiveAt)}</strong>})}
      <SubText>
        {effectiveNow
          ? t('These changes will apply immediately, and you will be billed today.')
          : t('This change will take effect at the end of your current contract period.')}
      </SubText>
    </Header>
  );
}

function ReviewAndConfirmItems({previewData}: Pick<State, 'previewData'>) {
  if (!previewData) {
    return null;
  }

  const {invoiceItems, creditApplied} = previewData;

  return (
    <PreviewItems>
      {invoiceItems.map(
        (
          {amount, type, description, period_start: periodStart, period_end: periodEnd},
          idx
        ) => {
          const price = displayPrice({cents: amount});
          const showDates = type === InvoiceItemType.SUBSCRIPTION;

          return (
            <PreviewItem showDates={showDates} key={idx}>
              <Title>
                <div>{description}</div>
                {showDates && (
                  <div data-test-id="dates">
                    {tct('Period: [periodStart] - [periodEnd]', {
                      periodStart: formatDate(periodStart),
                      periodEnd: formatDate(periodEnd),
                    })}
                  </div>
                )}
              </Title>
              <div>{`${price}`}</div>
            </PreviewItem>
          );
        }
      )}

      {!!creditApplied && (
        <PreviewItem key="credit">
          <div>{t('Credit applied')}</div>
          <div>{`${displayPrice({cents: -creditApplied})}`}</div>
        </PreviewItem>
      )}
    </PreviewItems>
  );
}

export function ReviewAndConfirmBody({
  cardActionError,
  loading,
  loadError,
  previewData,
  hasPartnerMigrationFeature,
  subscription,
}: Pick<State, 'cardActionError' | 'loading' | 'loadError' | 'previewData'> & {
  hasPartnerMigrationFeature: boolean;
  subscription: Subscription;
}) {
  if (loading) {
    return <LoadingIndicator />;
  }

  if (loadError) {
    return <LoadingError />;
  }

  if (!previewData) {
    return null;
  }

  const {invoiceItems} = previewData;
  if (!invoiceItems.length) {
    return (
      <Preview>{t('No immediate charge will be made to your credit card.')}</Preview>
    );
  }

  return (
    <Preview>
      <ReviewAndConfirmHeader
        previewData={previewData}
        hasPartnerMigrationFeature={hasPartnerMigrationFeature}
        subscription={subscription}
      />
      {cardActionError && (
        <Alert.Container>
          <Alert type="error">{cardActionError}</Alert>
        </Alert.Container>
      )}
      <ReviewAndConfirmItems previewData={previewData} />
      <PreviewTotal>
        <div>{t('Total due')}</div>
        <div>{`${displayPrice({cents: previewData.billedAmount})}`}</div>
      </PreviewTotal>
    </Preview>
  );
}

function MigrateNowBody({cardActionError, handleComplete, previewData, submitting}: any) {
  return (
    <MigrateNowAlert type="info" data-test-id={'migrate-now-body'}>
      <MigrateNowAlertContext>
        <div>{t('Why wait? Apply these changes immediately.')}</div>
        <MigrateNowButton
          onClick={() => handleComplete(true)}
          disabled={submitting || cardActionError !== null || !previewData}
          title={t('Apply these changes immediately')}
        >
          {t('Migrate Now')}
        </MigrateNowButton>
      </MigrateNowAlertContext>
    </MigrateNowAlert>
  );
}

type FooterProps = {
  handleComplete: (applyNow?: boolean) => void;
  hasMigrateNowButton: boolean;
  title: string;
} & Pick<State, 'submitting' | 'previewData' | 'cardActionError'>;

function ReviewAndConfirmFooter({
  cardActionError,
  handleComplete,
  previewData,
  submitting,
  title,
  hasMigrateNowButton = false,
}: FooterProps) {
  return (
    <StepFooter data-test-id={title}>
      <Button
        priority="primary"
        onClick={() => handleComplete()}
        disabled={submitting || cardActionError !== null || !previewData}
        title={
          hasMigrateNowButton
            ? t('Apply these changes at the end of your current contract period')
            : null
        }
      >
        {hasMigrateNowButton ? t('Schedule Changes') : t('Confirm Changes')}
      </Button>
    </StepFooter>
  );
}

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
`;

const Preview = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Header = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
`;

const SubText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  font-weight: normal;
`;

const Title = styled('div')`
  display: grid;
  grid-template-rows: auto;
  gap: ${space(1)};
`;

const PreviewItems = styled('div')`
  display: grid;
  grid-template-rows: auto;
  align-items: center;
`;

const BaseItem = styled('div')<{showDates?: boolean}>`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};
  justify-content: space-between;
  padding: ${space(1.5)} 0;
  align-items: center;

  ${p =>
    p.showDates &&
    css`
      align-items: end;
      padding-top: 0px;
    `}
`;

const PreviewItem = styled(BaseItem)`
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const PreviewTotal = styled(BaseItem)`
  padding-top: ${space(3)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  align-items: end;
  justify-content: center;
`;

const MigrateNowAlert = styled(Alert)`
  margin: ${space(2)};
  padding: ${space(1)};
`;

const MigrateNowAlertContext = styled('div')`
  margin-left: ${space(1)};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MigrateNowButton = styled(Button)`
  padding: 6px ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
  min-height: 0;
  height: min-content;
`;

export default withApi(ReviewAndConfirm);
