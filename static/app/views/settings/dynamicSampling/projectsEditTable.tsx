import {useCallback, useMemo} from 'react';
import partition from 'lodash/partition';

import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';
import {useProjectSampleCounts} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  isLoading: boolean;
  period: '24h' | '30d';
}

const {useFormField} = projectSamplingForm;
const EMPTY_ARRAY = [];

export function ProjectsEditTable({isLoading, period}: Props) {
  const {projects, fetching} = useProjects();

  const {value, initialValue, error, onChange} = useFormField('projectRates');

  const {data, isPending, isError, refetch} = useProjectSampleCounts({period});

  const dataByProjectId = data.reduce(
    (acc, item) => {
      acc[item.project.id] = item;
      return acc;
    },
    {} as Record<string, (typeof data)[0]>
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

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <ProjectsTable
      canEdit
      onChange={handleChange}
      emptyMessage={t('No active projects found in the selected period.')}
      isEmpty={!data.length}
      isLoading={fetching || isPending || isLoading}
      items={activeItems}
      inactiveItems={inactiveItems}
    />
  );
}
