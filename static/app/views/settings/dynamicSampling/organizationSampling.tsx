import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import useOrganization from 'sentry/utils/useOrganization';
import {OrganizationSampleRateField} from 'sentry/views/settings/dynamicSampling/organizationSampleRateField';
import {ProjectionPeriodControl} from 'sentry/views/settings/dynamicSampling/projectionPeriodControl';
import {ProjectsPreviewTable} from 'sentry/views/settings/dynamicSampling/projectsPreviewTable';
import {SamplingModeField} from 'sentry/views/settings/dynamicSampling/samplingModeField';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {
  type ProjectionSamplePeriod,
  useProjectSampleCounts,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';
import {useUpdateOrganization} from 'sentry/views/settings/dynamicSampling/utils/useUpdateOrganization';

const {useFormState, FormProvider} = organizationSamplingForm;
const UNSAVED_CHANGES_MESSAGE = t(
  'You have unsaved changes, are you sure you want to leave?'
);

export function OrganizationSampling() {
  const organization = useOrganization();
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const [period, setPeriod] = useState<ProjectionSamplePeriod>('24h');

  const formState = useFormState({
    initialValues: {
      targetSampleRate: ((organization.targetSampleRate ?? 1) * 100)?.toLocaleString(),
    },
  });

  const sampleCountsQuery = useProjectSampleCounts({period});

  const {mutate: updateOrganization, isPending} = useUpdateOrganization();

  const handleSubmit = () => {
    updateOrganization(
      {
        targetSampleRate: Number(formState.fields.targetSampleRate.value) / 100,
      },
      {
        onSuccess: () => {
          addSuccessMessage(t('Changes applied.'));
          formState.save();
        },
        onError: () => {
          addErrorMessage(t('Unable to save changes. Please try again.'));
        },
      }
    );
  };

  const handleReset = () => {
    formState.reset();
  };

  return (
    <FormProvider formState={formState}>
      <OnRouteLeave
        message={UNSAVED_CHANGES_MESSAGE}
        when={locationChange =>
          locationChange.currentLocation.pathname !==
            locationChange.nextLocation.pathname && formState.hasChanged
        }
      />
      <form onSubmit={event => event.preventDefault()} noValidate>
        <Panel>
          <PanelHeader>{t('General Settings')}</PanelHeader>
          <PanelBody>
            <SamplingModeField />
            <OrganizationSampleRateField />
          </PanelBody>
        </Panel>
        <FormActions>
          <Button disabled={!formState.hasChanged || isPending} onClick={handleReset}>
            {t('Reset')}
          </Button>
          <Tooltip
            disabled={hasAccess}
            title={t('You do not have permission to update these settings.')}
          >
            <Button
              priority="primary"
              disabled={
                !hasAccess || !formState.isValid || !formState.hasChanged || isPending
              }
              onClick={handleSubmit}
            >
              {t('Save changes')}
            </Button>
          </Tooltip>
        </FormActions>

        <HeadingRow>
          <h4>{t('Project Preview')}</h4>
          <ProjectionPeriodControl period={period} onChange={setPeriod} />
        </HeadingRow>
        <p>
          {tct(
            'This table gives you a preview of how your projects will be affected by the target sample rate. The [strong:estimated rates] are based on recent span volume and change continuously.',
            {
              strong: <strong />,
            }
          )}
        </p>
        <p>
          {t(
            'Rates apply to all spans in traces that start in each project, including a portion of spans in connected other projects.'
          )}
        </p>
        {sampleCountsQuery.isError ? (
          <LoadingError onRetry={sampleCountsQuery.refetch} />
        ) : (
          <ProjectsPreviewTable
            sampleCounts={sampleCountsQuery.data}
            isLoading={sampleCountsQuery.isPending}
          />
        )}
        <SubTextParagraph>
          {t('Inactive projects are not listed and will be sampled at 100% initially.')}
        </SubTextParagraph>
      </form>
    </FormProvider>
  );
}

const FormActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
  justify-content: flex-end;
  padding-bottom: ${space(4)};
`;

const HeadingRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${space(1.5)};

  & > h4 {
    margin: 0;
  }
`;

const SubTextParagraph = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;
