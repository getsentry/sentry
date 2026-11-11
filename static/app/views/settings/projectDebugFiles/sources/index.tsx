import {Fragment} from 'react';

import type {BuiltinSymbolSource, CustomRepo} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import {BuiltInRepositories} from './builtInRepositories';
import {CustomRepositories} from './customRepositories';

type Props = {
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
  customRepositories: CustomRepo[];
  organization: Organization;
  project: Project;
};

export function Sources({
  organization,
  customRepositories,
  builtinSymbolSources,
  builtinSymbolSourceOptions,
  project,
}: Props) {
  return (
    <Fragment>
      <BuiltInRepositories
        organization={organization}
        builtinSymbolSources={builtinSymbolSources}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        project={project}
      />
      <CustomRepositories
        organization={organization}
        customRepositories={customRepositories}
        project={project}
      />
    </Fragment>
  );
}
