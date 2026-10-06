import {useEffect} from 'react';

import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

type Props = {
  to: string;
};

/**
 * Like react-router v4+'s <Redirect to="path/" />, this component allows
 * redirects to be declarative.
 */
export function Redirect({to}: Props) {
  const navigate = useNavigate();
  const params = useParams();
  const resolvedTo = replaceRouterParams(to, params);

  // Redirect on mount.
  useEffect(() => {
    navigate(resolvedTo, {replace: true});
  }, [navigate, resolvedTo]);

  return null;
}
