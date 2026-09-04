import {Navigate} from 'react-router-dom';

import {useLocation} from 'sentry/utils/useLocation';

export default function LegacyStoriesRedirect() {
  const location = useLocation();

  return (
    <Navigate
      replace
      to={{
        pathname: location.pathname.replace(
          /^(\/organizations\/[^/]+)?\/stories(?=\/|$)/,
          '$1/scraps'
        ),
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}
