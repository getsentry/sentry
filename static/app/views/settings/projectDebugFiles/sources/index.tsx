import {Fragment} from 'react';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import type {BuiltinSymbolSource, CustomRepo} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import BuiltInRepositories from './builtInRepositories';
import CustomRepositories from './customRepositories';

type Props = {
  api: Client;
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
  customRepositories: CustomRepo[];
  location: Location;
  organization: Organization;
  project: Project;
};

export default function Sources({
  api,
  organization,
  customRepositories,
  builtinSymbolSources,
  builtinSymbolSourceOptions,
  project,
  location,
}: Props) {
  return (
    <Fragment>
      <BuiltInRepositories
        api={api}
        organization={organization}
        builtinSymbolSources={builtinSymbolSources}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        project={project}
      />
      <CustomRepositories
        api={api}
        location={location}
        organization={organization}
        customRepositories={customRepositories}
        project={project}
      />
    </Fragment>
  );
}
