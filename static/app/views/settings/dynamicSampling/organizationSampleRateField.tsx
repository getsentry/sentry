import {css} from '@emotion/react';
import styled from '@emotion/styled';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';

const {useFormField} = organizationSamplingForm;

export function OrganizationSampleRateField({}) {
  const field = useFormField('targetSampleRate');
  const hasAccess = useHasDynamicSamplingWriteAccess();

  return (
    <FieldGroup
      disabled={!hasAccess}
      required
      label={t('Target Sample Rate')}
      help={t(
        'Sentry automatically adapts the sample rates of your projects based on this organization-wide target.'
      )}
    >
      <InputWrapper
        css={css`
          width: 160px;
        `}
      >
        <Tooltip
          disabled={hasAccess}
          title={t('You do not have permission to change the sample rate.')}
        >
          <PercentInput
            type="number"
            disabled={!hasAccess}
            value={field.value}
            onChange={event => field.onChange(event.target.value)}
          />
        </Tooltip>
        {field.error ? (
          <ErrorMessage>{field.error}</ErrorMessage>
        ) : field.hasChanged ? (
          <PreviousValue>{t('previous: %f%%', field.initialValue)}</PreviousValue>
        ) : null}
      </InputWrapper>
    </FieldGroup>
  );
}

const PreviousValue = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
`;

const ErrorMessage = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.error};
`;

const InputWrapper = styled('div')`
  padding-top: 8px;
  height: 58px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
