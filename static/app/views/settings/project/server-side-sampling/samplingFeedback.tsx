import {Fragment} from 'react';
import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import {TextField} from 'sentry/components/forms';
import Textarea from 'sentry/components/forms/controls/textarea';
import Field from 'sentry/components/forms/field';
import MultipleCheckboxField from 'sentry/components/forms/MultipleCheckboxField';
import {RadioGroupRating} from 'sentry/components/radioGroupRating';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

enum SamplingUsageReason {
  REDUCE_VOLUME_TO_STAY_WITHIN_QUOTA = 'reduce_volume_to_stay_within_quota',
  FILTER_OUT_NOISY_DATA = 'filter_out_noisy_data',
  OTHER = 'other',
}

const samplingUsageReasons = [
  {
    title: t('Reduce volume to stay within my quota'),
    value: SamplingUsageReason.REDUCE_VOLUME_TO_STAY_WITHIN_QUOTA,
    checked: false,
  },
  {title: t('Filter out noisy data'), value: 1, checked: false},
  {title: t('Other'), value: SamplingUsageReason.OTHER, checked: false},
];

enum SampleByOption {
  TRANSACTION_NAME = 'transaction_name',
  CUSTOM_TAGS = 'custom_tags',
  OTHER = 'other',
}

const sampleByOptions = [
  {
    title: t('Transaction Name'),
    value: SampleByOption.TRANSACTION_NAME,
    checked: false,
  },
  {title: t('Custom Tags'), value: SampleByOption.CUSTOM_TAGS, checked: false},
  {title: t('Other'), value: SampleByOption.OTHER, checked: false},
];

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

type InitialData = {
  additionalFeedback: string | null;
  feelingIfFeatureNotAvailable: number | undefined;
  sampleByOptions: typeof sampleByOptions;
  sampleByOtherOption: string | null;
  samplingUsageOtherReason: string | null;
  samplingUsageReasons: typeof samplingUsageReasons;
  step: number;
};

const initialData: InitialData = {
  step: 0,
  samplingUsageReasons,
  samplingUsageOtherReason: null,
  sampleByOptions,
  sampleByOtherOption: null,
  additionalFeedback: null,
  feelingIfFeatureNotAvailable: undefined,
};

export function SamplingFeedback() {
  return (
    <FeatureFeedback featureName="dynamic-sampling" initialData={initialData}>
      {({Header, Body, Footer, state, onFieldChange}) => {
        if (state.step === 0) {
          return (
            <Fragment>
              <Header>{t('A few questions (1/2)')}</Header>
              <Body showSelfHostedMessage={false}>
                <SamplingUsageReasons
                  label={<Label>{t('Why do you want to use Dynamic Sampling?')}</Label>}
                  stacked
                  inline={false}
                  flexibleControlStateSize
                  choices={state.samplingUsageReasons}
                  onClick={value => {
                    const newSamplingUsageReasons = state.samplingUsageReasons.map(
                      samplingUsageReason => {
                        if (samplingUsageReason.value === value) {
                          return {
                            ...samplingUsageReason,
                            checked: !samplingUsageReason.checked,
                          };
                        }
                        return samplingUsageReason;
                      }
                    );

                    onFieldChange('samplingUsageReasons', newSamplingUsageReasons);
                  }}
                />
                <OtherField
                  inline={false}
                  name="samplingUsageOtherReason"
                  flexibleControlStateSize
                  stacked
                  disabled={state.samplingUsageReasons.some(
                    samplingUsageReason =>
                      samplingUsageReason.value === SamplingUsageReason.OTHER &&
                      samplingUsageReason.checked === false
                  )}
                  value={state.samplingUsageOtherReason}
                  onChange={value => onFieldChange('samplingUsageOtherReason', value)}
                  placeholder={t('Please kindly let us know the reason')}
                />
                <SampleByOptions
                  label={<Label>{t('What else you would like to sample by?')}</Label>}
                  stacked
                  inline={false}
                  flexibleControlStateSize
                  choices={state.sampleByOptions}
                  onClick={value => {
                    const newSampleByOptions = state.sampleByOptions.map(
                      sampleByOption => {
                        if (sampleByOption.value === value) {
                          return {
                            ...sampleByOption,
                            checked: !sampleByOption.checked,
                          };
                        }
                        return sampleByOption;
                      }
                    );
                    onFieldChange('sampleByOptions', newSampleByOptions);
                  }}
                />
                <OtherField
                  inline={false}
                  name="sampleByOtherOption"
                  flexibleControlStateSize
                  stacked
                  disabled={state.sampleByOptions.some(
                    sampleByOption =>
                      sampleByOption.value === SampleByOption.OTHER &&
                      sampleByOption.checked === false
                  )}
                  value={state.sampleByOtherOption}
                  onChange={value => onFieldChange('sampleByOtherOption', value)}
                  placeholder={t(
                    'Please kindly let us know by what, so we can improve your experience'
                  )}
                />
              </Body>
              <Footer onNext={() => onFieldChange('step', 1)} />
            </Fragment>
          );
        }

        const submitEventData = {
          contexts: {
            survey: {
              samplingUsageReasons: state.samplingUsageReasons
                .filter(samplingUsageReason => samplingUsageReason.checked)
                .map(samplingUsageReason => samplingUsageReason.title)
                .join(', '),
              samplingUsageOtherReason: state.samplingUsageOtherReason,
              sampleByOptions: state.sampleByOptions
                .filter(sampleByOption => sampleByOption.checked)
                .map(sampleByOption => sampleByOption.title)
                .join(', '),
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

const SamplingUsageReasons = styled(MultipleCheckboxField)`
  padding-bottom: 0;
`;

const SampleByOptions = styled(MultipleCheckboxField)`
  padding-bottom: 0;
`;

const OtherField = styled(TextField)``;
