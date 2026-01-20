import {useMemo} from 'react';
import uniq from 'lodash/uniq';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import useProjects from 'sentry/utils/useProjects';

export default function EnvironmentPicker({
  environment,
  onChange,
  project,
}: {
  environment: string | undefined;
  onChange: (environment: string) => void;
  project: string | undefined;
}) {
  const {projects} = useProjects();
  const environments = uniq(
    projects
      .filter(p => (project ? p.id === project : false))
      .flatMap(p => p.environments)
  );

  const options = useMemo(
    () => environments.map(env => ({label: env, value: env})),
    [environments]
  );

  return (
    <CompactSelect
      onChange={selected => onChange(selected.value)}
      options={options}
      searchable
      size="xs"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix="Environment" />
      )}
      value={environment}
    />
  );
}
