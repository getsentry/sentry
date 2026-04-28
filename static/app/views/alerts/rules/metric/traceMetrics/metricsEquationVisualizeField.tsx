import {useCallback} from 'react';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {Project} from 'sentry/types/project';
import {MetricsEquationVisualize} from 'sentry/views/detectors/components/forms/metric/metricsEquationVisualize';

export function MetricsEquationVisualizeField({
  project,
  onFilterSearch,
}: {
  onFilterSearch: (query: string, isQueryValid: any) => void;
  project: Project;
}) {
  const projectId = useFormField<string>('projectId') ?? project.id;
  const environment = useFormField<string | null>('environment') ?? null;

  // Must be stable — it's a dep of the editor's sync-to-form effect, so an
  // inline lambda would re-run the effect on every parent re-render and loop
  // through `setValue` → `handleFieldChange` → `setState`.
  const onQueryChange = useCallback(
    (query: string) => onFilterSearch(query, true),
    [onFilterSearch]
  );

  return (
    <MetricsEquationVisualize
      aggregateFieldName="aggregate"
      projectIds={projectId ? [Number(projectId)] : []}
      environments={environment ? [environment] : undefined}
      onQueryChange={onQueryChange}
    />
  );
}
