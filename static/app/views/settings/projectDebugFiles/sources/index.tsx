import {Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {Client} from 'sentry/api';
import {Organization, Project} from 'sentry/types';
import {BuiltinSymbolSource, CustomRepo} from 'sentry/types/debugFiles';

import BuiltInRepositories from './builtInRepositories';
import CustomRepositories from './customRepositories';

type Props = {
  api: Client;
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
  customRepositories: CustomRepo[];
  isLoading: boolean;
  location: Location;
  organization: Organization;
  projSlug: Project['slug'];
  router: InjectedRouter;
};

const Sources = ({
  api,
  organization,
  customRepositories,
  builtinSymbolSources,
  builtinSymbolSourceOptions,
  projSlug,
  location,
  router,
  isLoading,
}: Props) => {
  return (
    <Fragment>
      <BuiltInRepositories
        api={api}
        organization={organization}
        builtinSymbolSources={builtinSymbolSources}
        builtinSymbolSourceOptions={builtinSymbolSourceOptions}
        projSlug={projSlug}
        isLoading={isLoading}
      />
      <CustomRepositories
        api={api}
        location={location}
        router={router}
        organization={organization}
        customRepositories={customRepositories}
        projSlug={projSlug}
        isLoading={isLoading}
      />
    </Fragment>
  );
};

export default Sources;
