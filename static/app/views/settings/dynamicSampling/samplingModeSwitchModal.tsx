import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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

const schema = z.object({
  targetSampleRate: z
    .number()
    .min(0, {message: t('Must be between 0% and 100%')})
    .max(100, {message: t('Must be between 0% and 100%')}),
});

function SamplingModeSwitchModal({
  Header,
  Body,
  Footer,
  closeModal,
  samplingMode,
  initialTargetRate = 1,
}: Props & ModalRenderProps) {
  const {mutateAsync: updateOrganization, isPending} = useUpdateOrganization({
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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      targetSampleRate: Math.round(initialTargetRate * 100 * 100) / 100,
    },
    validators: {
      onDynamic: schema,
    },
    onSubmit: ({value}) => {
      const changes: Parameters<typeof updateOrganization>[0] = {samplingMode};
      if (samplingMode === 'organization') {
        changes.targetSampleRate = value.targetSampleRate / 100;
      }
      return updateOrganization(changes);
    },
  });

  return (
    <form.AppForm>
      <Header>
        <h5>
          {samplingMode === 'organization'
            ? t('Deactivate Advanced Mode')
            : t('Activate Advanced Mode')}
        </h5>
      </Header>
      <Body>
        <p>
          {samplingMode === 'organization'
            ? tct(
                'Deactivating advanced mode enables continuous adjustments for your projects based on a global target sample rate. Sentry boosts the sample rates of small projects and ensures equal visibility. [learnMoreLink:Learn more]',
                {
                  learnMoreLink: (
                    <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/" />
                  ),
                }
              )
            : tct(
                'Switching to advanced mode disables automatic adjustments. After the switch, you can configure individual sample rates for each project. [prioritiesLink:Dynamic sampling priorities] continue to apply within the projects. [learnMoreLink:Learn more]',
                {
                  prioritiesLink: (
                    <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/#dynamic-sampling-priorities" />
                  ),
                  learnMoreLink: (
                    <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/#advanced-mode" />
                  ),
                }
              )}
        </p>
        {samplingMode === 'organization' ? (
          <form.AppField name="targetSampleRate">
            {field => (
              <field.Layout.Stack label={t('Global Target Sample Rate')} required>
                <field.Number
                  value={field.state.value}
                  onChange={field.handleChange}
                  min={0}
                  max={100}
                  disabled={isPending}
                  trailingItems={<strong>%</strong>}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        ) : null}
        <p>
          {samplingMode === 'organization'
            ? tct(
                'By deactivating advanced mode, [strong:you will lose your manually configured sample rates].',
                {
                  strong: <strong />,
                }
              )
            : t('You can deactivate advanced mode at any time.')}
        </p>
      </Body>
      <Footer>
        <Flex gap="xl">
          <Button disabled={isPending} onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <form.SubmitButton priority="primary">
            {samplingMode === 'organization' ? t('Deactivate') : t('Activate')}
          </form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export function openSamplingModeSwitchModal(props: Props) {
  openModal(dialogProps => <SamplingModeSwitchModal {...dialogProps} {...props} />);
}
