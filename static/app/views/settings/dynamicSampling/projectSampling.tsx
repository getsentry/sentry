import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import {ProjectionPeriodControl} from 'sentry/views/settings/dynamicSampling/projectionPeriodControl';
import {ProjectsEditTable} from 'sentry/views/settings/dynamicSampling/projectsEditTable';
import {SamplingModeSwitch} from 'sentry/views/settings/dynamicSampling/samplingModeSwitch';
import {mapArrayToObject} from 'sentry/views/settings/dynamicSampling/utils';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {
  useProjectSampleCounts,
  type ProjectionSamplePeriod,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';
import {
  useGetSamplingProjectRates,
  useUpdateSamplingProjectRates,
} from 'sentry/views/settings/dynamicSampling/utils/useSamplingProjectRates';

const UNSAVED_CHANGES_MESSAGE = t(
  'You have unsaved changes, are you sure you want to leave?'
);

// Zod schema for type correctness. Per-project validation errors are computed
// in projectsEditTable via getProjectRateErrors.
const schema = z.object({
  projectRates: z.record(z.string(), z.string()),
});

export function ProjectSampling() {
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const [period, setPeriod] = useState<ProjectionSamplePeriod>('24h');
  const [editMode, setEditMode] = useState<'single' | 'bulk'>('single');

  const sampleRatesQuery = useGetSamplingProjectRates();
  const sampleCountsQuery = useProjectSampleCounts({period});
  const updateSamplingProjectRates = useUpdateSamplingProjectRates();

  const projectRates = useMemo(
    () =>
      (sampleRatesQuery.data || []).reduce(
        (acc, item) => {
          acc[item.id.toString()] = (item.sampleRate * 100).toString();
          return acc;
        },
        {} as Record<string, string>
      ),
    [sampleRatesQuery.data]
  );

  const [savedProjectRates, setSavedProjectRates] = useState<Record<string, string>>({});

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      projectRates: {} as Record<string, string>,
    },
    validators: {
      onDynamic: schema,
    },
    onSubmit: async ({value, formApi}) => {
      const ratesArray = Object.entries(value.projectRates).map(([id, rate]) => ({
        id: Number(id),
        sampleRate: parsePercent(rate),
      }));
      addLoadingMessage(t('Saving changes...'));
      try {
        await updateSamplingProjectRates.mutateAsync(ratesArray);
        setSavedProjectRates(value.projectRates);
        setEditMode('single');
        formApi.reset(value);
        addSuccessMessage(t('Changes applied'));
      } catch {
        addErrorMessage(t('Unable to save changes. Please try again.'));
      }
    },
  });

  // Mirror enableReInitialize: reset the form whenever the server data changes
  useEffect(() => {
    form.reset({projectRates});
    setSavedProjectRates(projectRates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRates]);

  const initialTargetRate = useMemo(() => {
    const sampleRates = sampleRatesQuery.data ?? [];
    const spanCounts = sampleCountsQuery.data ?? [];
    const totalSpanCount = spanCounts.reduce((acc, item) => acc + item.count, 0);

    const spanCountsById = mapArrayToObject({
      array: spanCounts,
      keySelector: item => item.project.id,
      valueSelector: item => item.count,
    });

    return (
      sampleRates.reduce((acc, item) => {
        const count = spanCountsById[item.id] ?? 0;
        return acc + count * item.sampleRate;
      }, 0) / totalSpanCount
    );
  }, [sampleRatesQuery.data, sampleCountsQuery.data]);

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.Subscribe selector={s => s.isDirty}>
          {isDirty => (
            <Fragment>
              <OnRouteLeave
                message={UNSAVED_CHANGES_MESSAGE}
                when={locationChange =>
                  locationChange.currentLocation.pathname !==
                    locationChange.nextLocation.pathname && isDirty
                }
              />
              <Flex justify="between" marginBottom="lg">
                <ProjectionPeriodControl period={period} onChange={setPeriod} />
                <SamplingModeSwitch initialTargetRate={initialTargetRate} />
              </Flex>
              {sampleCountsQuery.isError ? (
                <LoadingError onRetry={sampleCountsQuery.refetch} />
              ) : (
                <form.AppField name="projectRates">
                  {field => {
                    const hasProjectRateErrors =
                      field.state.value &&
                      Object.values(field.state.value).some(rate => {
                        if (!rate) return true;
                        const n = Number(rate);
                        return isNaN(n) || n < 0 || n > 100;
                      });
                    return (
                      <ProjectsEditTable
                        period={period}
                        editMode={editMode}
                        onEditModeChange={setEditMode}
                        isLoading={
                          sampleRatesQuery.isPending || sampleCountsQuery.isPending
                        }
                        sampleCounts={sampleCountsQuery.data}
                        projectRates={field.state.value}
                        savedProjectRates={savedProjectRates}
                        onProjectRatesChange={field.handleChange}
                        actions={
                          <Fragment>
                            <Button
                              disabled={!isDirty || updateSamplingProjectRates.isPending}
                              onClick={() => {
                                form.reset();
                                setEditMode('single');
                              }}
                            >
                              {t('Reset')}
                            </Button>
                            <Button
                              priority="primary"
                              type="submit"
                              disabled={
                                !hasAccess ||
                                !isDirty ||
                                !!hasProjectRateErrors ||
                                updateSamplingProjectRates.isPending
                              }
                            >
                              {t('Apply Changes')}
                            </Button>
                          </Fragment>
                        }
                      />
                    );
                  }}
                </form.AppField>
              )}
              <FormActions />
            </Fragment>
          )}
        </form.Subscribe>
      </form.FormWrapper>
    </form.AppForm>
  );
}

const FormActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${p => p.theme.space.md};
  justify-content: flex-end;
  padding-bottom: ${p => p.theme.space['3xl']};
`;
