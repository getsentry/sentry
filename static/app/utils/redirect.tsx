import {useEffect} from 'react';
import {InjectedRouter} from 'react-router';

import {useNavigate} from './useNavigate';

type Props = {
  to: string;
  router?: InjectedRouter;
};

// This is react-router v4 <Redirect to="path/" /> component to allow things
// to be declarative.
function Redirect({to, router}: Props) {
  // Redirect on mount.
  const navigate = useNavigate();
  useEffect(() => {
    if (router) {
      router.replace(to);
    } else {
      navigate(to, {replace: true});
    }
  }, []);

  return null;
}

export default Redirect;
