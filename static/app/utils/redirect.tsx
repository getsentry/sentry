import {useEffect} from 'react';
import {InjectedRouter} from 'react-router';

import {useNavigate} from './useNavigate';

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

  // Redirect on mount.
  useEffect(() => {
    if (router) {
      router.replace(to);
    } else {
      navigate(to, {replace: true});
    }
  }, [navigate, router, to]);

  return null;
}

export default Redirect;
