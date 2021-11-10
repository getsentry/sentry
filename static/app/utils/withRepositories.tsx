import * as React from 'react';

import {Repository} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

import useRepositories from './useRepositories';

type InjectedProps = {
  repositories?: Repository[];
  repositoriesLoading?: boolean;
  repositoriesError?: Error;
};

const withRepositories = <P extends InjectedProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  const WithRepositories: React.FC<Omit<P, keyof InjectedProps> & InjectedProps> =
    props => {
      const {repositories, loading, error} = useRepositories();
      return (
        <WrappedComponent
          // renaming props for legacy consistency
          repositories={repositories}
          repositoriesLoading={loading}
          repositoriesError={error}
          {...(props as P)}
        />
      );
    };

  WithRepositories.displayName = `withRepositories(${getDisplayName(WrappedComponent)})`;

  return WithRepositories;
};
export default withRepositories;
