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
  'Switching to manual mode will disable automatic adjustments for your projects. You will be able to set individual sample rates for each project. Those rates will be initially set to their current automatic value. [link:Learn more about sampling]',
  // TODO(aknaus): Add link to documentation
  {link: <ExternalLink href="https://docs.sentry.io" />}
);

const switchToAutoMessage = tct(
  'Switching to automatic mode will enable automatic adjustments for your projects based on a global rate. By switching [strong:you will lose your manually defined sample rates]. [link:Learn more about sampling]',
  // TODO(aknaus): Add link to documentation
  {link: <ExternalLink href="https://docs.sentry.io" />, strong: <strong />}
);

export function SamplingModeField() {
  const {samplingMode} = useOrganization();
  const hasAccess = useAccess({access: ['org:write']});

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
          ? t(
              'Take control over the individual sample rates in your projects. This disables automatic adjustments.'
            )
          : t(
              'Let Sentry monitor span volume and adjust sample rates automatically. This resets the custom rates below.'
            )
      }
    >
      <Confirm
        disabled={!hasAccess || isPending}
        message={
          <Fragment>
            <strong>{t('Are you sure?')}</strong>
            <p>
              {samplingMode === 'organization'
                ? switchToManualMessage
                : switchToAutoMessage}
            </p>
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
          {samplingMode === 'organization' ? t('Switch to Manual') : t('Switch to Auto')}
        </Button>
      </Confirm>
    </FieldGroup>
  );
}
