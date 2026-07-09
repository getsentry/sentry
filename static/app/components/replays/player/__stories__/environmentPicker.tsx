import {useMemo} from 'react';
import uniq from 'lodash/uniq';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useProjects} from 'sentry/utils/useProjects';

export function EnvironmentPicker({
  environment,
  onChange,
  project,
}: {
  environment: string | null | undefined;
  onChange: (environment: string | null) => void;
  project: string | null;
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
      onChange={selected => onChange(selected?.value ?? null)}
      options={options}
      search
      size="xs"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix="Environment" />
      )}
      value={environment ?? undefined}
    />
  );
}
