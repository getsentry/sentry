import {useMemo} from 'react';

import type {
  SelectOption,
  SelectOptionOrSection,
  SingleSelectProps,
} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';

interface EnvironmentSelectorProps
  extends Omit<SingleSelectProps<string>, 'onChange' | 'options' | 'value'> {
  onChange: (value: string) => void;
  value: string;
  allowAllEnvironments?: boolean;
}

export function EnvironmentSelector({
  value,
  onChange,
  allowAllEnvironments = true,
  disabled = false,
  ...props
}: EnvironmentSelectorProps) {
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

    const sections: Array<SelectOptionOrSection<string>> = [];
    if (allowAllEnvironments) {
      sections.push({
        key: 'all-environments',
        label: t('All Environments'),
        options: [{value: '', label: t('All Environments')}],
      });
    }

    sections.push(
      {
        key: 'my-projects',
        label: t('Environments in My Projects'),
        options: setToOptions(userEnvs),
      },
      {
        key: 'other-projects',
        label: t('Other Environments'),
        options: setToOptions(otherEnvs.difference(userEnvs)),
      }
    );
    return sections;
  }, [projects, allowAllEnvironments]);

  return (
    <CompactSelect<string>
      multiple={false}
      searchable
      size="md"
      sizeLimit={20}
      {...props}
      disabled={disabled || !projectsLoaded}
      onChange={selected => onChange(selected.value)}
      options={options}
      value={value}
    />
  );
}

const setToOptions = (set: Set<string>): Array<SelectOption<string>> =>
  Array.from(set).map(item => ({
    value: item,
    label: item,
  }));
