import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import {ProjectionPeriodControl} from 'sentry/views/settings/dynamicSampling/projectionPeriodControl';
import {ProjectsEditTable} from 'sentry/views/settings/dynamicSampling/projectsEditTable';
import {SamplingModeSwitch} from 'sentry/views/settings/dynamicSampling/samplingModeSwitch';
import {SankeyVisualization} from 'sentry/views/settings/dynamicSampling/sankeyVisualization';
import {mapArrayToObject} from 'sentry/views/settings/dynamicSampling/utils';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';
import {
  type ProjectionSamplePeriod,
  useProjectSampleCounts,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';
import {
  useGetSamplingProjectRates,
  useUpdateSamplingProjectRates,
} from 'sentry/views/settings/dynamicSampling/utils/useSamplingProjectRates';

const {useFormState, FormProvider} = projectSamplingForm;
const UNSAVED_CHANGES_MESSAGE = t(
  'You have unsaved changes, are you sure you want to leave?'
);

export function ProjectSampling() {
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const [period, setPeriod] = useState<ProjectionSamplePeriod>('24h');
  const [editMode, setEditMode] = useState<'single' | 'bulk'>('single');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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

  const initialValues = useMemo(() => ({projectRates}), [projectRates]);

  const formState = useFormState({
    initialValues,
    enableReInitialize: true,
  });

  // Initialize selected project to first project if none selected
  const projectSampleCounts = sampleCountsQuery.data;
  if (!selectedProjectId && projectSampleCounts && projectSampleCounts.length > 0) {
    setSelectedProjectId(projectSampleCounts[0]!.project.id);
  }

  const handleReset = () => {
    formState.reset();
    setEditMode('single');
  };

  const handleSubmit = () => {
    const ratesArray = Object.entries(formState.fields.projectRates.value).map(
      ([id, rate]) => ({
        id: Number(id),
        sampleRate: parsePercent(rate),
      })
    );
    addLoadingMessage(t('Saving changes...'));
    updateSamplingProjectRates.mutate(ratesArray, {
      onSuccess: () => {
        formState.save();
        setEditMode('single');
        addSuccessMessage(t('Changes applied'));
      },
      onError: () => {
        addErrorMessage(t('Unable to save changes. Please try again.'));
      },
    });
  };

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

  // Convert form string values to decimal sample rates for the visualization
  const currentSampleRates = useMemo(() => {
    const formValues = formState.fields.projectRates.value;
    if (!formValues) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(formValues).map(([id, rate]) => [id, parsePercent(rate)])
    );
  }, [formState.fields.projectRates.value]);

  const isFormActionDisabled =
    !hasAccess ||
    sampleRatesQuery.isPending ||
    updateSamplingProjectRates.isPending ||
    !formState.hasChanged;

  return (
    <FormProvider formState={formState}>
      <OnRouteLeave
        message={UNSAVED_CHANGES_MESSAGE}
        when={locationChange =>
          locationChange.currentLocation.pathname !==
            locationChange.nextLocation.pathname && formState.hasChanged
        }
      />
      <MainControlBar>
        <ProjectionPeriodControl period={period} onChange={setPeriod} />
        <SamplingModeSwitch initialTargetRate={initialTargetRate} />
      </MainControlBar>
      {sampleCountsQuery.isError ? (
        <LoadingError onRetry={sampleCountsQuery.refetch} />
      ) : (
        <ContentLayout>
          <TableSection>
            <ProjectsEditTable
              period={period}
              editMode={editMode}
              onEditModeChange={setEditMode}
              selectedProjectId={selectedProjectId}
              onProjectSelect={setSelectedProjectId}
              isLoading={sampleRatesQuery.isPending || sampleCountsQuery.isPending}
              sampleCounts={sampleCountsQuery.data}
              actions={
                <Fragment>
                  <Button disabled={isFormActionDisabled} onClick={handleReset}>
                    {t('Reset')}
                  </Button>
                  <Button
                    priority="primary"
                    disabled={isFormActionDisabled || !formState.isValid}
                    onClick={handleSubmit}
                  >
                    {t('Apply Changes')}
                  </Button>
                </Fragment>
              }
            />
          </TableSection>
          <VisualizationSection>
            <SankeyVisualization
              selectedProjectId={selectedProjectId}
              sampleCounts={sampleCountsQuery.data || []}
              sampleRates={currentSampleRates}
              isLoading={sampleRatesQuery.isPending || sampleCountsQuery.isPending}
            />
          </VisualizationSection>
        </ContentLayout>
      )}
      <FormActions />
    </FormProvider>
  );
}

const MainControlBar = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1.5)};
`;

const ContentLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
  align-items: start;
`;

const TableSection = styled('div')`
  /* Table takes up left half */
`;

const VisualizationSection = styled('div')`
  /* Visualization takes up right half */
`;

const FormActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
  justify-content: flex-end;
  padding-bottom: ${space(4)};
`;
