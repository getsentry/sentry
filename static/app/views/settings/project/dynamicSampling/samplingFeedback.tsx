import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import {TextField} from 'sentry/components/forms';
import Textarea from 'sentry/components/forms/controls/textarea';
import Field from 'sentry/components/forms/field';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';

enum TracingCapturingPriorities {
  TRANSACTION_NAME = 'transaction_name',
  CUSTOM_TAG = 'custom_tag',
  OTHER = 'other',
}

type Option = {
  checked: boolean;
  title: string;
  value: string | number;
};

type InitialData = {
  opinionAboutFeature: string;
  tracingCapturingOtherPriority: string;
  tracingCapturingPriorities: Option[];
};

const initialData: InitialData = {
  opinionAboutFeature: '',
  tracingCapturingPriorities: [
    {
      title: t('By transaction name'),
      value: TracingCapturingPriorities.TRANSACTION_NAME,
      checked: false,
    },
    {
      title: t('By custom tag'),
      value: TracingCapturingPriorities.CUSTOM_TAG,
      checked: false,
    },
    {
      title: t('Other'),
      value: TracingCapturingPriorities.OTHER,
      checked: false,
    },
  ],
  tracingCapturingOtherPriority: '',
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
  const feedbackMessage = `Dynamic Sampling feedback by ${ConfigStore.get('user').email}`;

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
        return (
          <Fragment>
            <Header>{t('Submit Feedback')}</Header>
            <Body showSelfHostedMessage={false}>
              <Field
                label={<Label>{t('What do you think about this feature?')}</Label>}
                stacked
                inline={false}
                flexibleControlStateSize
              >
                <Textarea
                  name="opinion-about-feedback"
                  value={state.opinionAboutFeature}
                  rows={5}
                  autosize
                  onChange={event =>
                    onFieldChange('opinionAboutFeature', event.target.value)
                  }
                />
              </Field>
              <Field
                label={
                  <Label>
                    {t(
                      'What other priorities would you like Sentry to apply for trace capturing?'
                    )}
                  </Label>
                }
                stacked
                inline={false}
                flexibleControlStateSize
              >
                <MultipleCheckboxField
                  options={state.tracingCapturingPriorities}
                  onChange={newTracingCapturingPriorities => {
                    if (
                      newTracingCapturingPriorities.some(
                        newTracingCapturingPriority =>
                          newTracingCapturingPriority.value ===
                            TracingCapturingPriorities.OTHER &&
                          newTracingCapturingPriority.checked === false
                      )
                    ) {
                      onFieldChange('tracingCapturingOtherPriority', '');
                    }
                    onFieldChange(
                      'tracingCapturingPriorities',
                      newTracingCapturingPriorities
                    );
                  }}
                  otherTextField={
                    <OtherTextField
                      inline={false}
                      name="tracingCapturingOtherPriority"
                      flexibleControlStateSize
                      stacked
                      disabled={state.tracingCapturingPriorities.some(
                        tracingCapturingPriority =>
                          tracingCapturingPriority.value ===
                            TracingCapturingPriorities.OTHER &&
                          tracingCapturingPriority.checked === false
                      )}
                      onClick={event => event.stopPropagation()}
                      value={state.tracingCapturingOtherPriority}
                      onChange={value =>
                        onFieldChange('tracingCapturingOtherPriority', value)
                      }
                      placeholder={t('Please let us know which other priority')}
                    />
                  }
                />
              </Field>
            </Body>
            <Footer
              primaryDisabledReason={
                !state.opinionAboutFeature.trim() &&
                state.tracingCapturingPriorities.every(
                  tracingCapturingPriority => tracingCapturingPriority.checked === false
                )
                  ? t('Please answer at least one question')
                  : undefined
              }
              submitEventData={{
                contexts: {
                  feedback: {
                    opinionAboutFeature: state.opinionAboutFeature || null,
                    tracingCapturingPriorities:
                      state.tracingCapturingPriorities
                        .filter(
                          tracingCapturingPriority => tracingCapturingPriority.checked
                        )
                        .map(tracingCapturingPriority => tracingCapturingPriority.title)
                        .join(', ') || null,
                    tracingCapturingOtherPriority:
                      state.tracingCapturingOtherPriority || null,
                  },
                },
                message: state.opinionAboutFeature.trim()
                  ? `${feedbackMessage} - ${state.opinionAboutFeature}`
                  : feedbackMessage,
              }}
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
