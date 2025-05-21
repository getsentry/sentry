import {useMemo} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';

interface EnvironmentSelectorProps {
  onChange: (value: string) => void;
  value: string;
}

export function EnvironmentSelector({value, onChange}: EnvironmentSelectorProps) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const userProjectEnvironments = useMemo<Set<string>>(() => {
    return new Set(
      projects.flatMap(project => {
        if (project.isMember) {
          return project.environments;
        }
        return [];
      })
    );
  }, [projects]);

  const otherEnvironments = useMemo<Set<string>>(() => {
    return new Set(
      projects.flatMap(project => {
        if (!project.isMember) {
          return project.environments;
        }
        return [];
      })
    );
  }, [projects]).difference(userProjectEnvironments);

  const options = [
    {
      key: 'my-projects',
      label: t('Environments in My Projects'),
      options: setToOptions(userProjectEnvironments),
    },
    {
      key: 'other-projects',
      label: t('Other Environments'),
      options: setToOptions(otherEnvironments),
    },
  ];

  return (
    <CompactSelect<string>
      size="md"
      triggerProps={{prefix: t('Environment')}}
      options={options}
      searchable
      disabled={!projectsLoaded}
      sizeLimit={10}
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
