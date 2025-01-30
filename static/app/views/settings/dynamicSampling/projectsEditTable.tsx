import type React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';
import {OrganizationSampleRateInput} from 'sentry/views/settings/dynamicSampling/organizationSampleRateInput';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';
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
  period: ProjectionSamplePeriod;
  sampleCounts: ProjectSampleCount[];
}

const {useFormField} = projectSamplingForm;
const EMPTY_ARRAY: any = [];

export function ProjectsEditTable({
  actions,
  isLoading: isLoadingProp,
  sampleCounts,
  editMode,
  period,
  onEditModeChange,
}: Props) {
  const {projects, fetching} = useProjects();
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const {value, initialValue, error, onChange} = useFormField('projectRates');
  const [isBulkEditEnabled, setIsBulkEditEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [orgRate, setOrgRate] = useState<string>('');

  const projectRateSnapshotRef = useRef<Record<string, string>>({});

  const dataByProjectId = useMemo(
    () =>
      sampleCounts.reduce(
        (acc, item) => {
          acc[item.project.id] = item;
          return acc;
        },
        {} as Record<string, (typeof sampleCounts)[0]>
      ),
    [sampleCounts]
  );

  useEffect(() => {
    if (isBulkEditEnabled) {
      inputRef.current?.focus();
    }
  }, [isBulkEditEnabled]);

  const handleProjectChange = useCallback(
    (projectId: string, newRate: string) => {
      onChange(prev => ({
        ...prev,
        [projectId]: newRate,
      }));
      onEditModeChange('single');
    },
    [onChange, onEditModeChange]
  );

  const handleOrgChange = useCallback(
    (newRate: string) => {
      if (editMode === 'single') {
        projectRateSnapshotRef.current = value;
      }
      const cappedOrgRate = parsePercent(newRate, 1);

      const scalingItems = Object.entries(projectRateSnapshotRef.current)
        .map(([projectId, rate]) => ({
          id: projectId,
          sampleRate: rate ? parsePercent(rate) : 0,
          count: dataByProjectId[projectId]?.count ?? 0,
        }))
        // We do not wan't to bulk edit inactive projects as they have no effect on the outcome
        .filter(item => item.count !== 0);

      const {scaledItems} = scaleSampleRates({
        items: scalingItems,
        sampleRate: cappedOrgRate,
      });

      const newProjectValues = scaledItems.reduce((acc, item) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[item.id] = formatPercent(item.sampleRate);
        return acc;
      }, {});
      onChange(prev => {
        return {...prev, ...newProjectValues};
      });

      setOrgRate(newRate);
      onEditModeChange('bulk');
    },
    [dataByProjectId, editMode, onChange, onEditModeChange, value]
  );

  const handleBulkEditChange = useCallback((newValue: boolean) => {
    setIsBulkEditEnabled(newValue);
    if (newValue === false) {
      // Parse to ensure valid values
      setOrgRate(rate => (parsePercent(rate, 1) * 100).toString());
    }
  }, []);

  const items = useMemo(
    () =>
      projects.map(project => {
        const item = dataByProjectId[project.id] as
          | (typeof dataByProjectId)[string]
          | undefined;
        return {
          id: project.slug,
          name: project.slug,
          count: item?.count || 0,
          ownCount: item?.ownCount || 0,
          subProjects: item?.subProjects ?? EMPTY_ARRAY,
          project,
          initialSampleRate: initialValue[project.id]!,
          sampleRate: value[project.id]!,
          error: error?.[project.id],
        };
      }),
    [dataByProjectId, error, initialValue, projects, value]
  );

  const totalSpanCount = useMemo(
    () => items.reduce((acc, item) => acc + item.count, 0),
    [items]
  );

  const projectedOrgRate = useMemo(() => {
    if (editMode === 'bulk') {
      return orgRate;
    }
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * parsePercent(value[item.project.id], 1),
      0
    );
    return formatPercent(totalSampledSpans / totalSpanCount);
  }, [editMode, items, orgRate, totalSpanCount, value]);

  const initialOrgRate = useMemo(() => {
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * parsePercent(initialValue[item.project.id], 1),
      0
    );
    return formatPercent(totalSampledSpans / totalSpanCount);
  }, [initialValue, items, totalSpanCount]);

  const breakdownSampleRates = useMemo(
    () =>
      Object.entries(value).reduce(
        (acc, [projectId, rate]) => {
          acc[projectId] = parsePercent(rate);
          return acc;
        },
        {} as Record<string, number>
      ),
    [value]
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
              value={projectedOrgRate}
              hasAccess={hasAccess}
              isBulkEditEnabled
              isBulkEditActive={isBulkEditEnabled}
              onBulkEditChange={handleBulkEditChange}
              onChange={handleOrgChange}
              showPreviousValue={initialOrgRate !== projectedOrgRate}
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
  border-top: 1px solid ${p => p.theme.innerBorder};
  display: flex;
  justify-content: flex-end;
  gap: ${space(2)};
  padding: ${space(1.5)} ${space(2)};
`;
