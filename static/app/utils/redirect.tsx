import {useEffect} from 'react';
import {InjectedRouter} from 'react-router';
import {LocationDescriptor} from 'history';

type Props = {
  router: InjectedRouter;
  to: LocationDescriptor;
};

// This is react-router v4 <Redirect to="path/" /> component to allow things
// to be declarative.
function Redirect({to, router}: Props) {
  // Redirect on mount.
  useEffect(() => router.replace(to), []);

  return null;
}

export default Redirect;
