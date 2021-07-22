import {Fragment} from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import {Location} from 'history';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource, CustomRepo} from 'app/types/debugFiles';

import BuiltInRepositories from './builtInRepositories';
import CustomRepositories from './customRepositories';

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  customRepositories: CustomRepo[];
  builtinSymbolSources: string[];
  router: InjectedRouter;
  location: Location;
};

function ExternalSources({
  api,
  organization,
  customRepositories,
  builtinSymbolSources,
  builtinSymbolSourceOptions,
  projectSlug,
  location,
  router,
}: Props) {
  return (
    <Fragment>
      <BuiltInRepositories
        api={api}
        organization={organization}
        builtinSymbolSources={builtinSymbolSources}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        projectSlug={projectSlug}
      />
      <CustomRepositories
        api={api}
        location={location}
        router={router}
        organization={organization}
        customRepositories={customRepositories}
        projectSlug={projectSlug}
      />
    </Fragment>
  );
}

export default ExternalSources;
