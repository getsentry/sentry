import {css} from '@emotion/react';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export function SamplingModeField() {
  const {samplingMode} = useOrganization();

  // TODO: Add logic to switch between manual and automatic sampling mode
  return (
    <FieldGroup
      disabled
      label={t('Switch Mode')}
      help={t(
        'Take control over the individual sample rates in your projects. This disables automatic adjustments.'
      )}
    >
      <Confirm disabled>
        <Button
          title={t('This feature is not yet available.')}
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
