import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import useProjects from 'sentry/utils/useProjects';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';
import {scaleSampleRates} from 'sentry/views/settings/dynamicSampling/utils/scaleSampleRates';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  isLoading: boolean;
  sampleCounts: ProjectSampleCount[];
}

const {useFormField} = projectSamplingForm;
const EMPTY_ARRAY = [];

export function ProjectsEditTable({isLoading: isLoadingProp, sampleCounts}: Props) {
  const {projects, fetching} = useProjects();
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const {value, initialValue, error, onChange} = useFormField('projectRates');

  const [orgRate, setOrgRate] = useState<string>('');
  const [editMode, setEditMode] = useState<'single' | 'bulk'>('single');
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

  const handleProjectChange = useCallback(
    (projectId: string, newRate: string) => {
      onChange(prev => ({
        ...prev,
        [projectId]: newRate,
      }));
      setEditMode('single');
    },
    [onChange]
  );

  const handleOrgChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newRate = event.target.value;
      if (editMode === 'single') {
        projectRateSnapshotRef.current = value;
      }

      const scalingItems = Object.entries(projectRateSnapshotRef.current)
        .map(([projectId, rate]) => ({
          id: projectId,
          sampleRate: rate ? Number(rate) / 100 : 0,
          count: dataByProjectId[projectId]?.count ?? 0,
        }))
        // We do not wan't to bulk edit inactive projects as they have no effect on the outcome
        .filter(item => item.count !== 0);

      const {scaledItems} = scaleSampleRates({
        items: scalingItems,
        sampleRate: Number(newRate) / 100,
      });

      const newProjectValues = scaledItems.reduce((acc, item) => {
        acc[item.id] = formatNumberWithDynamicDecimalPoints(item.sampleRate * 100, 2);
        return acc;
      }, {});
      onChange(prev => {
        return {...prev, ...newProjectValues};
      });

      setOrgRate(newRate);
      setEditMode('bulk');
    },
    [dataByProjectId, editMode, onChange, value]
  );

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
          project: project,
          initialSampleRate: initialValue[project.id],
          sampleRate: value[project.id],
          error: error?.[project.id],
        };
      }),
    [dataByProjectId, error, initialValue, projects, value]
  );
  const [activeItems, inactiveItems] = partition(items, item => item.count > 0);

  const projectedOrgRate = useMemo(() => {
    if (editMode === 'bulk') {
      return orgRate;
    }
    const totalSpans = items.reduce((acc, item) => acc + item.count, 0);
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * Number(value[item.project.id] ?? 100),
      0
    );
    return formatNumberWithDynamicDecimalPoints(totalSampledSpans / totalSpans, 2);
  }, [editMode, items, orgRate, value]);

  const breakdownSampleRates = useMemo(
    () =>
      Object.entries(value).reduce(
        (acc, [projectId, rate]) => {
          acc[projectId] = Number(rate) / 100;
          return acc;
        },
        {} as Record<string, number>
      ),
    [value]
  );

  const isLoading = fetching || isLoadingProp;

  return (
    <Fragment>
      <BreakdownPanel>
        {isLoading ? (
          <LoadingIndicator
            css={css`
              margin: ${space(4)} 0;
            `}
          />
        ) : (
          <Fragment>
            <SamplingBreakdown
              sampleCounts={sampleCounts}
              sampleRates={breakdownSampleRates}
            />
            <Divider />
            <ProjectedOrgRateWrapper>
              {t('Projected Organization Rate')}
              <div>
                <PercentInput
                  type="number"
                  disabled={!hasAccess}
                  size="sm"
                  onChange={handleOrgChange}
                  value={projectedOrgRate}
                />
              </div>
            </ProjectedOrgRateWrapper>
          </Fragment>
        )}
      </BreakdownPanel>

      <ProjectsTable
        canEdit
        onChange={handleProjectChange}
        emptyMessage={t('No active projects found in the selected period.')}
        isLoading={isLoading}
        items={activeItems}
        inactiveItems={inactiveItems}
      />
    </Fragment>
  );
}

const BreakdownPanel = styled(Panel)`
  margin-bottom: ${space(3)};
  padding: ${space(2)};
`;

const ProjectedOrgRateWrapper = styled('label')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const Divider = styled('hr')`
  margin: ${space(2)} -${space(2)};
  border: none;
  border-top: 1px solid ${p => p.theme.innerBorder};
`;
