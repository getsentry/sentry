import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {dynamicSamplingForm} from 'sentry/views/settings/dynamicSampling/dynamicSamplingForm';
import {TargetSampleRateField} from 'sentry/views/settings/dynamicSampling/targetSampleRateField';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';

const {useFormState, FormProvider} = dynamicSamplingForm;

export function DynamicSampling() {
  const api = useApi();
  const organization = useOrganization();
  const {hasAccess} = useAccess({access: ['org:write']});

  const formState = useFormState({
    targetSampleRate: ((organization.targetSampleRate ?? 1) * 100)?.toLocaleString(),
    samplingMode: 'auto' as const,
  });

  const modeField = formState.fields.samplingMode;
  const endpoint = `/organizations/${organization.slug}/`;

  const {mutate: updateOrganization, isPending} = useMutation({
    mutationFn: () => {
      const {fields} = formState;
      return api.requestPromise(endpoint, {
        method: 'PUT',
        data: {
          targetSampleRate: Number(fields.targetSampleRate.value) / 100,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Changes applied.'));
      formState.save();
    },
    onError: () => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    },
  });

  const handleSubmit = () => {
    updateOrganization();
  };

  const handleReset = () => {
    formState.reset();
  };

  return (
    <FormProvider formState={formState}>
      <form onSubmit={event => event.preventDefault()}>
        <Panel>
          <PanelHeader>{t('Automatic Sampling')}</PanelHeader>
          <PanelBody>
            <FieldGroup
              label={t('Sampling Mode')}
              help={t('Changes the level of detail and configuring sample rates.')}
            >
              {t('Automatic Balancing')}
            </FieldGroup>
            {/* TODO(aknaus): move into separate component when we make it interactive */}
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
                  {modeField.value === 'auto'
                    ? t('Switch to Manual')
                    : t('Switch to Auto')}
                </Button>
              </Confirm>
            </FieldGroup>
            {modeField.value === 'auto' ? <TargetSampleRateField /> : null}
          </PanelBody>
        </Panel>
        <FormActions>
          <Button disabled={!formState.hasChanged || isPending} onClick={handleReset}>
            {t('Reset')}
          </Button>
          <Button
            priority="primary"
            disabled={
              !hasAccess || !formState.isValid || !formState.hasChanged || isPending
            }
            onClick={handleSubmit}
          >
            {t('Save changes')}
          </Button>
        </FormActions>
      </form>
    </FormProvider>
  );
}

const FormActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
  justify-content: flex-end;
`;
