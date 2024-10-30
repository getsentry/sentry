import {Fragment} from 'react';
import {css} from '@emotion/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateOrganization} from 'sentry/views/settings/dynamicSampling/utils/useUpdateOrganization';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';

const switchToManualMessage = tct(
  'Switching to manual mode disables automatic adjustments. After the switch, you can configure individual sample rates for each project. Dynamic sampling priorities continue to apply within the projects. [link:Learn more]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
    ),
  }
);

const switchToAutoMessage = tct(
  'Switching to automatic mode enables continuous adjustments for your projects based on a global target sample rate. Sentry boosts the sample rates of small projects and ensures equal visibility. [link:Learn more]',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
    ),
  }
);

export function SamplingModeField() {
  const {samplingMode} = useOrganization();
  const {hasAccess} = useAccess({access: ['org:write']});

  const {mutate: updateOrganization, isPending} = useUpdateOrganization({
    onMutate: () => {
      addLoadingMessage(t('Switching sampling mode...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Changes applied.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    },
  });

  const handleSwitchMode = () => {
    updateOrganization({
      samplingMode: samplingMode === 'organization' ? 'project' : 'organization',
    });
  };

  return (
    <FieldGroup
      disabled={!hasAccess}
      label={t('Switch Mode')}
      help={
        samplingMode === 'organization'
          ? t('Take control over the individual sample rates in your projects.')
          : t('Let Sentry monitor span volume and adjust sample rates automatically.')
      }
    >
      <Confirm
        disabled={!hasAccess || isPending}
        message={
          <Fragment>
            <p>
              {samplingMode === 'organization'
                ? switchToManualMessage
                : switchToAutoMessage}
            </p>
            {samplingMode === 'organization' ? (
              <p>{t('You can switch back to automatic mode at any time.')}</p>
            ) : (
              <p>
                {tct(
                  'By switching [strong:you will lose your manually defined sample rates].',
                  {
                    strong: <strong />,
                  }
                )}
              </p>
            )}
          </Fragment>
        }
        header={
          <h5>
            {samplingMode === 'organization'
              ? t('Switch to Manual Mode')
              : t('Switch to Automatic Mode')}
          </h5>
        }
        confirmText={t('Switch Mode')}
        cancelText={t('Cancel')}
        onConfirm={handleSwitchMode}
      >
        <Button
          css={css`
            width: max-content;
          `}
        >
          {samplingMode === 'organization'
            ? t('Switch to Manual')
            : t('Switch to Automatic')}
        </Button>
      </Confirm>
    </FieldGroup>
  );
}
