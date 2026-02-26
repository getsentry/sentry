import {useContext, useMemo} from 'react';

import type {SelectOption, SelectOptionOrSection} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';

import FormContext from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';

export function EnvironmentSelector() {
  const value = useFormField<string | null>('environment');
  const {form} = useContext(FormContext);
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
      search
      disabled={!projectsLoaded}
      sizeLimit={20}
      multiple={false}
      value={value ?? ''}
      onChange={selected => form?.setValue('environment', selected.value || null)}
    />
  );
}

const setToOptions = (set: Set<string>): Array<SelectOption<string>> =>
  Array.from(set).map(item => ({
    value: item,
    label: item,
  }));
