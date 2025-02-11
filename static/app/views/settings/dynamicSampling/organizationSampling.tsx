import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import useOrganization from 'sentry/utils/useOrganization';
import {ProjectionPeriodControl} from 'sentry/views/settings/dynamicSampling/projectionPeriodControl';
import {ProjectsPreviewTable} from 'sentry/views/settings/dynamicSampling/projectsPreviewTable';
import {SamplingModeSwitch} from 'sentry/views/settings/dynamicSampling/samplingModeSwitch';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
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
        targetSampleRate: parsePercent(formState.fields.targetSampleRate.value),
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
      <HeadingRow>
        <ProjectionPeriodControl period={period} onChange={setPeriod} />
        <SamplingModeSwitch />
      </HeadingRow>
      {sampleCountsQuery.isError ? (
        <LoadingError onRetry={sampleCountsQuery.refetch} />
      ) : (
        <ProjectsPreviewTable
          sampleCounts={sampleCountsQuery.data}
          isLoading={sampleCountsQuery.isPending}
          period={period}
          actions={
            <Fragment>
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
            </Fragment>
          }
        />
      )}
      <SubTextParagraph>
        {t('Inactive projects are not listed and will be sampled at 100% initially.')}
      </SubTextParagraph>
    </FormProvider>
  );
}
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
