import {useMemo} from 'react';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import useProjects from 'sentry/utils/useProjects';

export default function ProjectPicker({
  onChange,
  project,
}: {
  onChange: (project: string) => void;
  project: string | undefined;
}) {
  const {projects} = useProjects();

  const options = useMemo(
    () => projects.map(p => ({value: p.id, label: p.slug})),
    [projects]
  );

  return (
    <CompactSelect
      onChange={selected => onChange(selected.value)}
      options={options}
      searchable
      size="xs"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix="Project" />
      )}
      value={project}
    />
  );
}
