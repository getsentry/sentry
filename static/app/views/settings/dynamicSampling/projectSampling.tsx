import React, {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import {ProjectionPeriodControl} from 'sentry/views/settings/dynamicSampling/projectionPeriodControl';
import {ProjectsEditTable} from 'sentry/views/settings/dynamicSampling/projectsEditTable';
import {SamplingModeField} from 'sentry/views/settings/dynamicSampling/samplingModeField';
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

  // TODO(aknaus): This calculation + stiching of the two requests is repeated in a few places
  // and should be moved to a shared utility function.
  const initialTargetRate = useMemo(() => {
    const sampleRates = sampleRatesQuery.data ?? [];
    const spanCounts = sampleCountsQuery.data ?? [];
    const totalSpanCount = spanCounts.reduce((acc, item) => acc + item.count, 0);

    const spanCountsById = spanCounts.reduce(
      (acc, item) => {
        acc[item.project.id] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    return (
      sampleRates.reduce((acc, item) => {
        const count = spanCountsById[item.id] ?? 0;
        return acc + count * item.sampleRate;
      }, 0) / totalSpanCount
    );
  }, [sampleRatesQuery.data, sampleCountsQuery.data]);

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
      <form onSubmit={event => event.preventDefault()} noValidate>
        <Panel>
          <PanelHeader>{t('General Settings')}</PanelHeader>
          <PanelBody>
            <SamplingModeField initialTargetRate={initialTargetRate} />
          </PanelBody>
        </Panel>
        <HeadingRow>
          <h4>{t('Customize Projects')}</h4>
          <ProjectionPeriodControl period={period} onChange={setPeriod} />
        </HeadingRow>
        <p>
          {t(
            'Configure sample rates for each of your projects. These rates stay fixed if volumes change, which can lead to a change in the overall sample rate of your organization.'
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
          <ProjectsEditTable
            period={period}
            editMode={editMode}
            onEditModeChange={setEditMode}
            isLoading={sampleRatesQuery.isPending || sampleCountsQuery.isPending}
            sampleCounts={sampleCountsQuery.data}
          />
        )}
        <FormActions>
          <Button disabled={isFormActionDisabled} onClick={handleReset}>
            {t('Reset')}
          </Button>
          <ScrollIntoViewButton enabled={!isFormActionDisabled && formState.isValid}>
            <Button
              priority="primary"
              disabled={isFormActionDisabled || !formState.isValid}
              onClick={handleSubmit}
            >
              {t('Apply Changes')}
            </Button>
          </ScrollIntoViewButton>
        </FormActions>
      </form>
    </FormProvider>
  );
}

function ScrollIntoViewButton({
  children,
  enabled,
}: {
  children: React.ReactElement;
  enabled: boolean;
}) {
  if (React.Children.count(children) !== 1) {
    throw new Error('ScrollIntoViewButton only accepts a single child');
  }

  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement>();

  useEffect(() => {
    if (!targetElement || !enabled) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      observerEntries => {
        const entry = observerEntries[0]!;
        setIsVisible(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.5,
      }
    );

    observer.observe(targetElement);
    return () => {
      observer.disconnect();
      setIsVisible(false);
    };
  }, [targetElement, enabled]);

  return (
    <Fragment>
      {React.cloneElement(children, {ref: setTargetElement})}
      {isVisible && (
        <Tooltip title={t('Scroll down to apply changes')} skipWrapper>
          <FloatingButton
            type="button"
            onClick={() => {
              targetElement?.scrollIntoView({behavior: 'smooth'});
            }}
            initial={{opacity: 0, scale: 0.5}}
            animate={{opacity: 1, scale: 1}}
            transition={{
              ease: [0, 0.71, 0.2, 1.4],
            }}
          >
            <IconArrow direction="down" size="sm" />
          </FloatingButton>
        </Tooltip>
      )}
    </Fragment>
  );
}

const FloatingButton = styled(motion.button)`
  position: fixed;
  bottom: ${space(4)};
  right: ${space(1)};
  border-radius: 50%;
  border: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.purple400};
  color: ${p => p.theme.white};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

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
  padding-top: ${space(3)};
  padding-bottom: ${space(1.5)};

  & > * {
    margin: 0;
  }
`;
