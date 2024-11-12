import {Fragment, useCallback, useMemo} from 'react';
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
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  isLoading: boolean;
  sampleCounts: ProjectSampleCount[];
}

const {useFormField} = projectSamplingForm;
const EMPTY_ARRAY = [];

export function ProjectsEditTable({isLoading: isLoadingProp, sampleCounts}: Props) {
  const {projects, fetching} = useProjects();

  const {value, initialValue, error, onChange} = useFormField('projectRates');

  const dataByProjectId = sampleCounts.reduce(
    (acc, item) => {
      acc[item.project.id] = item;
      return acc;
    },
    {} as Record<string, (typeof sampleCounts)[0]>
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

  const handleChange = useCallback(
    (projectId: string, newRate: string) => {
      onChange(prev => ({
        ...prev,
        [projectId]: newRate,
      }));
    },
    [onChange]
  );

  // weighted average of all projects' sample rates
  const totalSpans = items.reduce((acc, item) => acc + item.count, 0);
  const projectedOrgRate = useMemo(() => {
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * Number(value[item.project.id] ?? 100),
      0
    );
    return totalSampledSpans / totalSpans;
  }, [items, value, totalSpans]);

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
            <ProjectedOrgRateWrapper>
              {t('Projected Organization Rate')}
              <PercentInput
                type="number"
                disabled
                size="sm"
                value={formatNumberWithDynamicDecimalPoints(projectedOrgRate, 2)}
              />
            </ProjectedOrgRateWrapper>
            <Divider />
            <SamplingBreakdown
              sampleCounts={sampleCounts}
              sampleRates={breakdownSampleRates}
            />
          </Fragment>
        )}
      </BreakdownPanel>

      <ProjectsTable
        canEdit
        onChange={handleChange}
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
