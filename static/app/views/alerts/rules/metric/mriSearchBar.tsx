import {Project} from 'sentry/types';
import {useMetricsTags} from 'sentry/utils/metrics';
import {parseAggregate} from 'sentry/views/alerts/rules/metric/mriField';
import {MetricSearchBar} from 'sentry/views/ddm/queryBuilder';

interface MriSearchBarProps {
  aggregate: string;
  onChange: (query: string) => void;
  project: Project;
  defaultQuery?: string;
  placeholder?: string;
  query?: string;
}

export function MriSearchBar({
  aggregate,
  project,
  onChange,
  placeholder,
  query,
  defaultQuery,
}: MriSearchBarProps) {
  const mri = parseAggregate(aggregate).mri;

  const {data: tags = []} = useMetricsTags(mri, [parseInt(project.id, 10)]);

  return (
    <MetricSearchBar
      mri={mri}
      tags={tags}
      onChange={onChange}
      useFormWrapper={false}
      placeholder={placeholder}
      query={query}
      defaultQuery={defaultQuery}
      searchSource="alert_builder"
    />
  );
}
