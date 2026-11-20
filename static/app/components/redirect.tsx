import {useEffect, useEffectEvent} from 'react';
import {useLocation, useNavigate, type NavigateProps} from 'react-router';

import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {useParams} from 'sentry/utils/useParams';

type Props = Omit<NavigateProps, 'to'> & {
  to: string;
};

/**
 * Like react-router v4+'s <Redirect to="path/" />, this component allows
 * redirects to be declarative.
 */
export function Redirect({to, state, replace = true, relative}: Props) {
  const navigate = useNavigate();
  const {key} = useLocation();
  const params = useParams();
  const resolvedTo = replaceRouterParams(to, params);
  // Read the outgoing key without redirecting again when the location key changes.
  const getLocationKey = useEffectEvent(() => key);

  useEffect(() => {
    navigate(resolvedTo, {
      replace,
      relative,
      state: {...state, redirectFromLocationKey: getLocationKey()},
    });
  }, [navigate, resolvedTo, replace, relative, state]);

  return null;
}
