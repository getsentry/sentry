import {useMemo} from 'react';

import type {
  SelectOption,
  SelectOptionOrSection,
} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';

interface EnvironmentSelectorProps {
  onChange: (value: string) => void;
  value: string;
}

export function EnvironmentSelector({value, onChange}: EnvironmentSelectorProps) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const options = useMemo<Array<SelectOptionOrSection<string>>>(() => {
    const userEnvs = new Set<string>();
    const otherEnvs = new Set<string>();

    projects.forEach(project => {
      if (project.isMember) {
        project.environments.forEach(env => userEnvs.add(env));
      } else {
        project.environments.forEach(env => otherEnvs.add(env));
      }
    });

    return [
      {
        key: 'all-environments',
        label: t('All Environments'),
        options: [{value: '', label: t('All Environments')}],
      },
      {
        key: 'my-projects',
        label: t('Environments in My Projects'),
        options: setToOptions(userEnvs),
      },
      {
        key: 'other-projects',
        label: t('Other Environments'),
        options: setToOptions(otherEnvs.difference(userEnvs)),
      },
    ];
  }, [projects]);

  return (
    <CompactSelect
      size="md"
      options={options}
      searchable
      disabled={!projectsLoaded}
      sizeLimit={20}
      multiple={false}
      value={value}
      onChange={selected => onChange(selected.value)}
    />
  );
}

const setToOptions = (set: Set<string>): Array<SelectOption<string>> =>
  Array.from(set).map(item => ({
    value: item,
    label: item,
  }));
