import {useEffect} from 'react';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

type Props = {
  to: string;
  router?: InjectedRouter;
};

/**
 * Like react-router v4+'s <Redirect to="path/" />, this component allows
 * redirects to be declarative.
 */
function Redirect({to, router}: Props) {
  const navigate = useNavigate();
  const params = useParams();
  const resolvedTo = replaceRouterParams(to, params);

  // Redirect on mount.
  useEffect(() => {
    if (router) {
      router.replace(resolvedTo);
    } else {
      navigate(resolvedTo, {replace: true});
    }
  }, [navigate, router, resolvedTo]);

  return null;
}

export default Redirect;
