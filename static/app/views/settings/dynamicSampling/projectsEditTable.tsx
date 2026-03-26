import type React from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';
import {OrganizationSampleRateInput} from 'sentry/views/settings/dynamicSampling/organizationSampleRateInput';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {mapArrayToObject} from 'sentry/views/settings/dynamicSampling/utils';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {scaleSampleRates} from 'sentry/views/settings/dynamicSampling/utils/scaleSampleRates';
import type {
  ProjectionSamplePeriod,
  ProjectSampleCount,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  actions: React.ReactNode;
  editMode: 'single' | 'bulk';
  isLoading: boolean;
  onEditModeChange: (mode: 'single' | 'bulk') => void;
  onProjectRatesChange: (
    updater:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>)
  ) => void;
  period: ProjectionSamplePeriod;
  projectRates: Record<string, string>;
  sampleCounts: ProjectSampleCount[];
  savedProjectRates: Record<string, string>;
  showErrors?: boolean;
}

const EMPTY_ARRAY: any = [];

function getProjectRateError(rate: string): string | undefined {
  if (rate === '') {
    return t('This field is required');
  }
  if (isNaN(Number(rate))) {
    return t('Please enter a valid number');
  }
  if (Number(rate) < 0 || Number(rate) > 100) {
    return t('Must be between 0% and 100%');
  }
  return undefined;
}

export function ProjectsEditTable({
  actions,
  isLoading: isLoadingProp,
  sampleCounts,
  editMode,
  period,
  onEditModeChange,
  projectRates,
  savedProjectRates,
  onProjectRatesChange,
  showErrors,
}: Props) {
  const {projects, fetching} = useProjects();
  const [isBulkEditEnabled, setIsBulkEditEnabled] = useState(false);
  const [orgRate, setOrgRate] = useState<string>('');

  const projectRateSnapshotRef = useRef<Record<string, string>>({});

  const dataByProjectId = useMemo(
    () =>
      mapArrayToObject({
        array: sampleCounts,
        keySelector: item => item.project.id,
        valueSelector: item => item,
      }),
    [sampleCounts]
  );

  const handleProjectChange = useCallback(
    (projectId: string, newRate: string) => {
      onProjectRatesChange(prev => ({
        ...prev,
        [projectId]: newRate,
      }));
      onEditModeChange('single');
    },
    [onProjectRatesChange, onEditModeChange]
  );

  const handleOrgChange = useCallback(
    (newRate: string) => {
      // Editing the org rate will transition the logic to bulk edit mode.
      // On the first edit, we need to snapshot the current project rates as scaling baseline
      // to avoid rounding errors when scaling the sample rates up and down.
      if (editMode === 'single') {
        projectRateSnapshotRef.current = projectRates;
      }

      const cappedOrgRate = parsePercent(newRate, 1);
      const scalingItems = Object.entries(projectRateSnapshotRef.current)
        .map(([projectId, rate]) => ({
          id: projectId,
          sampleRate: rate ? parsePercent(rate) : 0,
          count: dataByProjectId[projectId]?.count ?? 0,
        }))
        // We do not want to bulk edit inactive projects as they have no effect on the outcome
        .filter(item => item.count !== 0);

      const {scaledItems} = scaleSampleRates({
        items: scalingItems,
        sampleRate: cappedOrgRate,
      });

      const newProjectValues = mapArrayToObject({
        array: scaledItems,
        keySelector: item => item.id,
        valueSelector: item => formatPercent(item.sampleRate),
      });

      onProjectRatesChange(prev => ({...prev, ...newProjectValues}));
      setOrgRate(newRate);
      onEditModeChange('bulk');
    },
    [dataByProjectId, editMode, onProjectRatesChange, onEditModeChange, projectRates]
  );

  const handleBulkEditChange = useCallback((newIsActive: boolean) => {
    setIsBulkEditEnabled(newIsActive);

    // On exiting the bulk edit mode, we need to ensure the displayed org rate is a valid percentage
    if (newIsActive === false) {
      setOrgRate(rate => (parsePercent(rate, 1) * 100).toString());
    }
  }, []);

  const items = useMemo(
    () =>
      projects.map(project => {
        const item = dataByProjectId[project.id];
        return {
          id: project.slug,
          name: project.slug,
          count: item?.count || 0,
          ownCount: item?.ownCount || 0,
          subProjects: item?.subProjects ?? EMPTY_ARRAY,
          project,
          initialSampleRate: savedProjectRates[project.id]!,
          sampleRate: projectRates[project.id]!,
          error: showErrors
            ? getProjectRateError(projectRates[project.id] ?? '')
            : undefined,
        };
      }),
    [dataByProjectId, showErrors, savedProjectRates, projects, projectRates]
  );

  const totalSpanCount = useMemo(
    () => items.reduce((acc, item) => acc + item.count, 0),
    [items]
  );

  // In bulk edit mode, we display the org rate from the input state.
  // In single edit mode, we display the estimated org rate based on the current sample rates.
  const displayedOrgRate = useMemo(() => {
    if (editMode === 'bulk') {
      return orgRate;
    }
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * parsePercent(projectRates[item.project.id], 1),
      0
    );
    return formatPercent(totalSampledSpans / totalSpanCount);
  }, [editMode, items, orgRate, totalSpanCount, projectRates]);

  const initialOrgRate = useMemo(() => {
    const totalSampledSpans = items.reduce(
      (acc, item) =>
        acc + item.count * parsePercent(savedProjectRates[item.project.id], 1),
      0
    );
    return formatPercent(totalSampledSpans / totalSpanCount);
  }, [savedProjectRates, items, totalSpanCount]);

  const breakdownSampleRates = useMemo(
    () =>
      mapArrayToObject({
        array: Object.entries(projectRates),
        keySelector: ([projectId, _]) => projectId,
        valueSelector: ([_, rate]) => parsePercent(rate),
      }),
    [projectRates]
  );

  const isLoading = fetching || isLoadingProp;

  return (
    <Fragment>
      <SamplingBreakdown
        sampleCounts={sampleCounts}
        sampleRates={breakdownSampleRates}
        isLoading={isLoading}
      />
      <Panel>
        {isLoading ? (
          <LoadingIndicator
            css={css`
              margin: 60px 0;
            `}
          />
        ) : (
          <Fragment>
            <OrganizationSampleRateInput
              label={t('Estimated Organization Rate')}
              help={t('An estimate of the combined sample rate for all projects.')}
              value={displayedOrgRate}
              isBulkEditEnabled
              isBulkEditActive={isBulkEditEnabled}
              onBulkEditChange={handleBulkEditChange}
              onChange={handleOrgChange}
              showPreviousValue={initialOrgRate !== displayedOrgRate}
              previousValue={initialOrgRate}
            />
            <ProjectsTable
              rateHeader={t('Target Rate')}
              canEdit={!isBulkEditEnabled}
              onChange={handleProjectChange}
              emptyMessage={t('No active projects found in the selected period.')}
              period={period}
              isLoading={isLoading}
              items={items}
            />
            <Footer>{actions}</Footer>
          </Fragment>
        )}
      </Panel>
    </Fragment>
  );
}

const Footer = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  display: flex;
  justify-content: flex-end;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
`;
