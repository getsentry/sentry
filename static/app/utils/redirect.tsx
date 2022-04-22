import {useEffect} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import {LocationDescriptor} from 'history';

type Props = {
  to: LocationDescriptor;
  router?: InjectedRouter;
};

// This is react-router v4 <Redirect to="path/" /> component to allow things
// to be declarative.
function Redirect({to, router}: Props) {
  // Redirect on mount.
  useEffect(() => {
    if (router) {
      router.replace(to);
    } else {
      browserHistory.replace(to);
    }
  }, []);

  return null;
}

export default Redirect;
