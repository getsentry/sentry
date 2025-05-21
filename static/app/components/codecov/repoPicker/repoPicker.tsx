import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {RepoSelector} from 'sentry/components/codecov/repoPicker/repoSelector';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function RepoPicker() {
  const {repository} = useCodecovContext();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <RepoSelector
      repository={repository}
      onChange={newRepository => {
        const currentParams = new URLSearchParams(location.search);
        currentParams.set('repository', newRepository);
        navigate(`${location.pathname}?${currentParams.toString()}`, {replace: true});
      }}
    />
  );
}
