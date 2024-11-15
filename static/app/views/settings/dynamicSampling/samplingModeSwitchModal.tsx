import {useId} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {useUpdateOrganization} from 'sentry/views/settings/dynamicSampling/utils/useUpdateOrganization';

interface Props {
  /**
   * The sampling mode to switch to.
   */
  samplingMode: Organization['samplingMode'];
  /**
   * The initial target rate for the automatic sampling mode.
   * Required if `samplingMode` is 'automatic'.
   */
  initialTargetRate?: number;
}

const {FormProvider, useFormState, useFormField} = organizationSamplingForm;

function SamplingModeSwitchModal({
  Header,
  Body,
  Footer,
  closeModal,
  samplingMode,
  initialTargetRate = 1,
}: Props & ModalRenderProps) {
  const formState = useFormState({
    initialValues: {
      targetSampleRate: formatPercent(initialTargetRate),
    },
  });

  const {mutate: updateOrganization, isPending} = useUpdateOrganization({
    onMutate: () => {
      addLoadingMessage(t('Switching sampling mode...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Changes applied.'));
      closeModal();
    },
    onError: () => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    },
  });

  const handleSubmit = () => {
    if (!formState.isValid) {
      return;
    }
    const changes: Parameters<typeof updateOrganization>[0] = {
      samplingMode,
    };
    if (samplingMode === 'organization') {
      changes.targetSampleRate = parsePercent(formState.fields.targetSampleRate.value);
    }
    updateOrganization(changes);
  };

  return (
    <FormProvider formState={formState}>
      <form
        onSubmit={event => {
          event.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        <Header>
          <h5>
            {samplingMode === 'organization'
              ? t('Switch to Automatic Mode')
              : t('Switch to Manual Mode')}
          </h5>
        </Header>
        <Body>
          <p>
            {samplingMode === 'organization'
              ? tct(
                  'Switching to automatic mode enables continuous adjustments for your projects based on a global target sample rate. Sentry boosts the sample rates of small projects and ensures equal visibility. [link:Learn more]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                    ),
                  }
                )
              : tct(
                  'Switching to manual mode disables automatic adjustments. After the switch, you can configure individual sample rates for each project. [prioritiesLink:Dynamic sampling priorities] continue to apply within the projects. [link:Learn more]',
                  {
                    prioritiesLink: (
                      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                    ),
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                    ),
                  }
                )}
          </p>
          {samplingMode === 'organization' && <TargetRateInput disabled={isPending} />}
          <p>
            {samplingMode === 'organization'
              ? tct(
                  'By switching [strong:you will lose your manually configured sample rates].',
                  {
                    strong: <strong />,
                  }
                )
              : t('You can switch back to automatic mode at any time.')}
          </p>
        </Body>
        <Footer>
          <ButtonWrapper>
            <Button disabled={isPending} onClick={closeModal}>
              {t('Cancel')}
            </Button>
            <Button
              priority="primary"
              disabled={isPending || !formState.isValid}
              onClick={handleSubmit}
            >
              {t('Switch Mode')}
            </Button>
          </ButtonWrapper>
        </Footer>
      </form>
    </FormProvider>
  );
}

function TargetRateInput({disabled}: {disabled?: boolean}) {
  const id = useId();
  const {value, onChange, error} = useFormField('targetSampleRate');

  return (
    <FieldGroup
      label={t('Global Target Sample Rate')}
      css={{paddingBottom: space(0.5)}}
      inline={false}
      showHelpInTooltip
      flexibleControlStateSize
      stacked
      required
    >
      <InputWrapper>
        <PercentInput
          id={id}
          aria-label={t('Global Target Sample Rate')}
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
        />
        <ErrorMessage>
          {error
            ? error
            : // Placholder character to keep the space occupied
              '\u200b'}
        </ErrorMessage>
      </InputWrapper>
    </FieldGroup>
  );
}

const InputWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const ErrorMessage = styled('div')`
  color: ${p => p.theme.red300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const ButtonWrapper = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

export function openSamplingModeSwitchModal(props: Props) {
  openModal(dialogProps => <SamplingModeSwitchModal {...dialogProps} {...props} />);
}
