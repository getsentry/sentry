import {Fragment, useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import type {Project} from 'sentry/types/project';
import useAssertionBaseFormQueryParams from 'sentry/utils/replays/assertions/useAssertionBaseFormQueryParams';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getProjectOptions} from 'sentry/views/alerts/rules/utils';

interface Props {
  disabled?: boolean;
}

export default function AssertionBaseForm({disabled}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const {project, environment, setProjectSlug, setEnvironment} =
    useAssertionBaseFormQueryParams();

  const projectOptions = useMemo(
    () =>
      getProjectOptions({
        organization,
        projects,
        isFormDisabled: false,
      }),
    [organization, projects]
  );

  return (
    <Fragment>
      <CompactSelect
        size="md"
        disabled={disabled}
        value={project?.id}
        options={projectOptions}
        onChange={({value}: {value: Project['id']}) => {
          setProjectSlug(value);
        }}
      />

      <EnvironmentSelector
        size="md"
        disabled={disabled}
        allowAllEnvironments={false}
        value={environment}
        onChange={setEnvironment}
      />
    </Fragment>
  );
}
