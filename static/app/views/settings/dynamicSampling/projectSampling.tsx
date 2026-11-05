import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {z} from 'zod';

import {useScrapsForm, ScrapsForm, defaultFormValidators} from '@sentry/scraps/form';
import {Flex, Grid} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {LegacyOnRouteLeave} from 'sentry/router/legacy/onRouteLeave';
import {mapArrayToObject} from 'sentry/utils/array/mapArrayToObject';

import {useHasDynamicSamplingWriteAccess} from './utils/access';
import {parsePercent} from './utils/parsePercent';
import {sampleRateField} from './utils/schemas';
import {
  useProjectSampleCounts,
  type ProjectionSamplePeriod,
} from './utils/useProjectSampleCounts';
import {
  useGetSamplingProjectRates,
  useUpdateSamplingProjectRates,
} from './utils/useSamplingProjectRates';
import {ProjectionPeriodControl} from './projectionPeriodControl';
import {ProjectsEditTable} from './projectsEditTable';
import {SamplingModeSwitch} from './samplingModeSwitch';

const UNSAVED_CHANGES_MESSAGE = t(
  'You have unsaved changes, are you sure you want to leave?'
);

const projectSamplingSchema = z.object({
  projectRates: z.record(z.string(), sampleRateField),
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
      (sampleRatesQuery.data || []).reduce<Record<string, string>>((acc, item) => {
        acc[item.id.toString()] = (item.sampleRate * 100).toString();
        return acc;
      }, {}),
    [sampleRatesQuery.data]
  );

  const [savedProjectRates, setSavedProjectRates] = useState(projectRates);

  const form = useScrapsForm({
    defaultValues: {
      projectRates,
    },
    validators: defaultFormValidators(projectSamplingSchema),
    onSubmit: async ({value, formApi}) => {
      const ratesArray = Object.entries(value.projectRates).map(([id, rate]) => ({
        id: Number(id),
        sampleRate: parsePercent(rate),
      }));
      toast.loading(t('Saving changes...'));
      try {
        await updateSamplingProjectRates.mutateAsync(ratesArray);
        setSavedProjectRates(value.projectRates);
        setEditMode('single');
        formApi.reset(value);
        toast.success(t('Changes applied'));
      } catch {
        toast.error(t('Unable to save changes. Please try again.'));
      }
    },
  });

  const handleProjectRateChange = useCallback(
    (projectId: string, rate: string) => {
      form.setFieldValue(`projectRates.${projectId}`, rate);
    },
    [form]
  );

  const handleBulkProjectRateChange = useCallback(
    (updates: Record<string, string>) => {
      form.setFieldValue('projectRates', prev => ({...prev, ...updates}));
    },
    [form]
  );

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
    <ScrapsForm form={form}>
      <form.Subscribe
        selector={s => ({
          isDirty: s.isDirty,
          currentProjectRates: s.values.projectRates,
        })}
      >
        {({isDirty, currentProjectRates}) => {
          const projectErrors: Record<string, string | undefined> = {};
          const validation = projectSamplingSchema.safeParse({
            projectRates: currentProjectRates,
          });
          if (!validation.success) {
            for (const issue of validation.error.issues) {
              const id = issue.path[1];
              if (typeof id === 'string' && projectErrors[id] === undefined) {
                projectErrors[id] = issue.message;
              }
            }
          }

          return (
            <Fragment>
              <LegacyOnRouteLeave
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
                <ProjectsEditTable
                  period={period}
                  editMode={editMode}
                  onEditModeChange={setEditMode}
                  onProjectRateChange={handleProjectRateChange}
                  onBulkProjectRateChange={handleBulkProjectRateChange}
                  projectRates={currentProjectRates}
                  projectErrors={projectErrors}
                  isLoading={sampleRatesQuery.isPending || sampleCountsQuery.isPending}
                  sampleCounts={sampleCountsQuery.data}
                  savedProjectRates={savedProjectRates}
                  actions={
                    <Fragment>
                      <form.ResetButton
                        disabled={updateSamplingProjectRates.isPending}
                        onClick={() => setEditMode('single')}
                      >
                        {t('Reset')}
                      </form.ResetButton>
                      <form.SubmitButton disabled={!hasAccess} formNoValidate>
                        {t('Apply Changes')}
                      </form.SubmitButton>
                    </Fragment>
                  }
                />
              )}
              <Grid
                justify="end"
                paddingBottom="3xl"
                gap="md"
                columns="repeat(2, max-content)"
              />
            </Fragment>
          );
        }}
      </form.Subscribe>
    </ScrapsForm>
  );
}
