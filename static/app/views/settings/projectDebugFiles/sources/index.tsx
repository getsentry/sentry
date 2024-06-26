import {Fragment} from 'react';
import type {InjectedRouter} from 'react-router';
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
  isError: boolean;
  isLoading: boolean;
  location: Location;
  onErrorRetry: () => void;
  organization: Organization;
  project: Project;
  router: InjectedRouter;
};

function Sources({
  api,
  organization,
  customRepositories,
  builtinSymbolSources,
  builtinSymbolSourceOptions,
  project,
  location,
  router,
  isLoading,
  isError,
  onErrorRetry,
}: Props) {
  return (
    <Fragment>
      <BuiltInRepositories
        api={api}
        organization={organization}
        builtinSymbolSources={builtinSymbolSources}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        project={project}
        isLoading={isLoading}
        isError={isError}
        onErrorRetry={onErrorRetry}
      />
      <CustomRepositories
        api={api}
        location={location}
        router={router}
        organization={organization}
        customRepositories={customRepositories}
        project={project}
        isLoading={isLoading}
        isError={isError}
        onErrorRetry={onErrorRetry}
      />
    </Fragment>
  );
}

export default Sources;
