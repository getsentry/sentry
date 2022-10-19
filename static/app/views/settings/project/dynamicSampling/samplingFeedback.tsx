import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import {TextField} from 'sentry/components/forms';
import Textarea from 'sentry/components/forms/controls/textarea';
import Field from 'sentry/components/forms/field';
import {RadioGroupRating} from 'sentry/components/radioGroupRating';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

enum SamplingUsageReason {
  REDUCE_VOLUME_TO_STAY_WITHIN_QUOTA = 'reduce_volume_to_stay_within_quota',
  FILTER_OUT_NOISY_DATA = 'filter_out_noisy_data',
  OTHER = 'other',
}

enum SampleByOption {
  TRANSACTION_NAME = 'transaction_name',
  CUSTOM_TAGS = 'custom_tags',
  OTHER = 'other',
}

const featureNotAvailableRatingOptions = {
  0: {
    label: t('Very Dissatisfied'),
    description: t("Not disappointed (It isn't really useful)"),
  },
  1: {
    label: t('Dissatisfied'),
  },
  2: {
    label: t('Neutral'),
  },
  3: {
    label: t('Satisfied'),
  },
  4: {
    description: t("Very disappointed (It's a deal breaker)"),
    label: t('Very Satisfied'),
  },
};

type Option = {
  checked: boolean;
  title: string;
  value: string | number;
};

type InitialData = {
  additionalFeedback: string | null;
  feelingIfFeatureNotAvailable: number | undefined;
  sampleByOptions: Option[];
  sampleByOtherOption: string | null;
  samplingUsageOtherReason: string | null;
  samplingUsageReasons: Option[];
  step: number;
};

const initialData: InitialData = {
  step: 0,
  samplingUsageReasons: [
    {
      title: t('Reduce volume to stay within my quota'),
      value: SamplingUsageReason.REDUCE_VOLUME_TO_STAY_WITHIN_QUOTA,
      checked: false,
    },
    {title: t('Filter out noisy data'), value: 1, checked: false},
    {
      title: t('Other'),
      value: SamplingUsageReason.OTHER,
      checked: false,
    },
  ],
  sampleByOtherOption: null,
  samplingUsageOtherReason: null,
  sampleByOptions: [
    {
      title: t('Transaction Name'),
      value: SampleByOption.TRANSACTION_NAME,
      checked: false,
    },
    {title: t('Custom Tags'), value: SampleByOption.CUSTOM_TAGS, checked: false},
    {
      title: t('Other'),
      value: SampleByOption.OTHER,
      checked: false,
    },
  ],
  additionalFeedback: null,
  feelingIfFeatureNotAvailable: undefined,
};

function MultipleCheckboxField({
  options,
  onChange,
  otherTextField,
}: {
  onChange: (options: Option[]) => void;
  options: Option[];
  otherTextField: React.ReactNode;
}) {
  const handleClick = useCallback(
    (newOption: Option) => {
      const newOptions = options.map(option => {
        if (option.value === newOption.value) {
          return {
            ...option,
            checked: !option.checked,
          };
        }
        return option;
      });

      onChange(newOptions);
    },
    [onChange, options]
  );

  return (
    <Fragment>
      {options.map(option => {
        if (option.value === 'other') {
          return (
            <CheckboxOtherOptionWrapper
              key={option.value}
              onClick={() => handleClick(option)}
            >
              <CheckboxFancy isChecked={option.checked} />
              {option.title}
              {otherTextField}
            </CheckboxOtherOptionWrapper>
          );
        }

        return (
          <CheckboxOption key={option.value} onClick={() => handleClick(option)}>
            <CheckboxFancy isChecked={option.checked} />
            {option.title}
          </CheckboxOption>
        );
      })}
    </Fragment>
  );
}

export function SamplingFeedback() {
  return (
    <FeatureFeedback
      featureName="dynamic-sampling"
      initialData={initialData}
      buttonProps={{
        priority: 'primary',
        size: 'sm',
      }}
    >
      {({Header, Body, Footer, state, onFieldChange}) => {
        if (state.step === 0) {
          return (
            <Fragment>
              <Header>{t('A few questions (1/2)')}</Header>
              <Body showSelfHostedMessage={false}>
                <Field
                  label={<Label>{t('Why do you want to use Dynamic Sampling?')}</Label>}
                  stacked
                  inline={false}
                  flexibleControlStateSize
                >
                  <MultipleCheckboxField
                    options={state.samplingUsageReasons}
                    onChange={newSamplingUsageReasons => {
                      if (
                        newSamplingUsageReasons.some(
                          newSamplingUsageReason =>
                            newSamplingUsageReason.value === SamplingUsageReason.OTHER &&
                            newSamplingUsageReason.checked === false
                        )
                      ) {
                        onFieldChange('samplingUsageOtherReason', null);
                      }

                      onFieldChange('samplingUsageReasons', newSamplingUsageReasons);
                    }}
                    otherTextField={
                      <OtherTextField
                        inline={false}
                        name="samplingUsageOtherReason"
                        flexibleControlStateSize
                        stacked
                        disabled={state.samplingUsageReasons.some(
                          samplingUsageReason =>
                            samplingUsageReason.value === SamplingUsageReason.OTHER &&
                            samplingUsageReason.checked === false
                        )}
                        onClick={event => event.stopPropagation()}
                        value={state.samplingUsageOtherReason}
                        onChange={value =>
                          onFieldChange('samplingUsageOtherReason', value)
                        }
                        placeholder={t('Please kindly let us know the reason')}
                      />
                    }
                  />
                </Field>
                <Field
                  label={<Label>{t('What else you would like to sample by?')}</Label>}
                  stacked
                  inline={false}
                  flexibleControlStateSize
                >
                  <MultipleCheckboxField
                    options={state.sampleByOptions}
                    onChange={newSampleByOptions => {
                      if (
                        newSampleByOptions.some(
                          sampleByOption =>
                            sampleByOption.value === SampleByOption.OTHER &&
                            sampleByOption.checked === false
                        )
                      ) {
                        onFieldChange('sampleByOtherOption', null);
                      }
                      onFieldChange('sampleByOptions', newSampleByOptions);
                    }}
                    otherTextField={
                      <OtherTextField
                        inline={false}
                        name="sampleByOtherOption"
                        flexibleControlStateSize
                        stacked
                        disabled={state.sampleByOptions.some(
                          sampleByOption =>
                            sampleByOption.value === SampleByOption.OTHER &&
                            sampleByOption.checked === false
                        )}
                        onClick={event => event.stopPropagation()}
                        value={state.sampleByOtherOption}
                        onChange={value => onFieldChange('sampleByOtherOption', value)}
                        placeholder={t('Please let us know which other attributes')}
                      />
                    }
                  />
                </Field>
              </Body>
              <Footer onNext={() => onFieldChange('step', 1)} />
            </Fragment>
          );
        }

        const submitEventData = {
          contexts: {
            survey: {
              samplingUsageReasons:
                state.samplingUsageReasons
                  .filter(samplingUsageReason => samplingUsageReason.checked)
                  .map(samplingUsageReason => samplingUsageReason.title)
                  .join(', ') || null,
              samplingUsageOtherReason: state.samplingUsageOtherReason,
              sampleByOptions:
                state.sampleByOptions
                  .filter(sampleByOption => sampleByOption.checked)
                  .map(sampleByOption => sampleByOption.title)
                  .join(', ') || null,
              sampleByOtherOption: state.sampleByOtherOption,
              additionalFeedback: state.additionalFeedback,
              feelingIfFeatureNotAvailable: defined(state.feelingIfFeatureNotAvailable)
                ? featureNotAvailableRatingOptions[state.feelingIfFeatureNotAvailable]
                    .label
                : null,
            },
          },
          message: state.additionalFeedback
            ? `Feedback: 'dynamic sampling' feature - ${state.additionalFeedback}`
            : `Feedback: 'dynamic sampling' feature`,
        };

        const primaryButtonDisabled = Object.keys(submitEventData.contexts.survey).every(
          s => {
            const value = submitEventData.contexts.survey[s] ?? null;

            if (typeof value === 'string') {
              return value.trim() === '';
            }

            return value === null;
          }
        );

        return (
          <Fragment>
            <Header>{t('A few questions (2/2)')}</Header>
            <Body>
              <RadioGroupRating
                label={
                  <Label>
                    {t('How would you feel if you could no longer use this feature?')}
                  </Label>
                }
                inline={false}
                required={false}
                flexibleControlStateSize
                stacked
                options={featureNotAvailableRatingOptions}
                name="feelingIfFeatureNotAvailableRating"
                defaultValue={
                  defined(state.feelingIfFeatureNotAvailable)
                    ? String(state.feelingIfFeatureNotAvailable)
                    : undefined
                }
                onChange={value =>
                  onFieldChange('feelingIfFeatureNotAvailable', Number(value))
                }
              />
              <Field
                label={<Label>{t('Anything else you would like to share?')}</Label>}
                inline={false}
                required={false}
                flexibleControlStateSize
                stacked
              >
                <Textarea
                  name="additional-feedback"
                  value={state.additionalFeedback ?? undefined}
                  rows={5}
                  autosize
                  onChange={event =>
                    onFieldChange('additionalFeedback', event.target.value)
                  }
                  placeholder={t('Additional feedback')}
                />
              </Field>
            </Body>
            <Footer
              onBack={() => onFieldChange('step', 0)}
              primaryDisabledReason={
                primaryButtonDisabled
                  ? t('Please answer at least one question')
                  : undefined
              }
              submitEventData={submitEventData}
            />
          </Fragment>
        );
      }}
    </FeatureFeedback>
  );
}

const Label = styled('strong')`
  margin-bottom: ${space(1)};
  display: inline-block;
`;

const CheckboxOption = styled('div')`
  cursor: pointer;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  :not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const CheckboxOtherOptionWrapper = styled(CheckboxOption)`
  grid-template-columns: max-content max-content 1fr;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: max-content 1fr;
  }
`;

const OtherTextField = styled(TextField)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 1/-1;
  }

  && {
    input {
      ${p => p.disabled && 'cursor: pointer;'}
    }
  }
`;
