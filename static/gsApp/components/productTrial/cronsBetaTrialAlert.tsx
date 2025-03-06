import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconClose, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {sendBetaCronsTrialOptIn} from 'getsentry/actionCreators/upsell';
import type {ProductTrialAlertProps} from 'getsentry/components/productTrial/productTrialAlert';
import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

export default function CronsBetaTrialAlert({
  api,
  organization,
  subscription,
  trial,
  onDismiss,
}: ProductTrialAlertProps) {
  const hasBillingRole = organization.access.includes('org:billing');
  const [optInSent, setOptInSent] = useState(false);
  const hasOptedIn = trial.betaOptInStatus;

  const actions = (
    <ButtonBar gap={1.5}>
      {!hasOptedIn && hasBillingRole && (
        <Button
          priority="primary"
          aria-label={t('I Agree')}
          disabled={optInSent}
          onClick={() =>
            sendBetaCronsTrialOptIn({
              api,
              organization,
              onSuccess: () => setOptInSent(true),
            })
          }
        >
          {t('I Agree')}
        </Button>
      )}
      <Button
        icon={<IconClose size="sm" />}
        data-test-id="btn-overage-notification-snooze"
        onClick={() => {
          trackGetsentryAnalytics('product_trial.clicked_snooze', {
            organization,
            subscription,
            event_types: DATA_CATEGORY_INFO.monitorSeat.plural,
            is_warning: false,
          });
          onDismiss?.();
        }}
        size="zero"
        borderless
        title={t('Dismiss this period')}
        aria-label={t('Dismiss this period')}
      />
    </ButtonBar>
  );

  return (
    <Alert.Container>
      <TrialAlert system type="info" trailingItems={actions}>
        <Heading>
          <IconWarning size="md" />
          <h4>{t('Free Beta ending soon')}</h4>
          <ProductTrialTag trial={trial} type="default" showTrialEnded />
        </Heading>
        <AlertTextContainer>
          {hasOptedIn
            ? t(
                'You are currently using a free beta version of Crons. At the end of your trial, you will be billed for all active monitors.'
              )
            : hasBillingRole
              ? tct(
                  'You are using a free beta version of Crons. Please note, when your trial ends, you get one monitor for free and you agree to be billed for each additional monitor from your On Demand budget. [link]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/accounts/pricing/#cron-monitors-pricing">
                        {t('Learn More')}
                      </ExternalLink>
                    ),
                  }
                )
              : t(
                  'You are using a free beta version of Crons. You will be able to continue using one monitor for free when the beta ends. If you need more than that, please have your billing admin log into Sentry to confirm.'
                )}
        </AlertTextContainer>
      </TrialAlert>
    </Alert.Container>
  );
}

const TrialAlert = styled(Alert)`
  align-items: center;
`;

const Heading = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: ${space(1)};

  h4 {
    margin: 0;
  }
`;

const AlertTextContainer = styled('div')`
  max-width: 800px;
`;
