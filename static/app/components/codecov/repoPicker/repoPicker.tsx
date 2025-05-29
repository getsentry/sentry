import {useSearchParams} from 'react-router-dom';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {RepoSelector} from 'sentry/components/codecov/repoPicker/repoSelector';

export function RepoPicker() {
  const {repository} = useCodecovContext();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <RepoSelector
      repository={repository}
      onChange={newRepository => {
        const currentParams = Object.fromEntries(searchParams.entries());
        const updatedParams = {
          ...currentParams,
          repository: newRepository,
        };
        setSearchParams(updatedParams);
      }}
    />
  );
}
