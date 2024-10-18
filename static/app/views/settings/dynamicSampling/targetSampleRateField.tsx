import styled from '@emotion/styled';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import {InputGroup} from 'sentry/components/inputGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {dynamicSamplingForm} from 'sentry/views/settings/dynamicSampling/dynamicSamplingForm';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';

const {useFormField} = dynamicSamplingForm;

export function TargetSampleRateField({}) {
  const field = useFormField('targetSampleRate');
  const {hasAccess} = useAccess({access: ['org:write']});

  return (
    <FieldGroup
      disabled={!hasAccess}
      required
      label={t('Target Sample Rate')}
      help={t(
        'Sentry will balance the sample rates of your projects automatically based on an overall target for your organization.'
      )}
      error={field.error}
    >
      <InputWrapper>
        <Tooltip
          disabled={hasAccess}
          title={t('You do not have permission to change the sample rate.')}
        >
          <InputGroup>
            <InputGroup.Input
              width={100}
              type="number"
              disabled={!hasAccess}
              value={field.value}
              onChange={event => field.onChange(event.target.value)}
            />
            <InputGroup.TrailingItems>
              <TrailingPercent>%</TrailingPercent>
            </InputGroup.TrailingItems>
          </InputGroup>
        </Tooltip>
        {field.hasChanged ? (
          <PreviousValue>{t('previous rate: %f%%', field.initialValue)}</PreviousValue>
        ) : null}
      </InputWrapper>
    </FieldGroup>
  );
}

const PreviousValue = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
`;

const InputWrapper = styled('div')`
  padding-top: 8px;
  height: 58px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TrailingPercent = styled('strong')`
  padding: 0 2px;
`;
