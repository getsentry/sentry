import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

export function useUserParams() {
  const location = useLocation();
  const {name, userKey, userValue} = location.query;
  return {
    location,
    name,
    userKey: decodeScalar(userKey),
    userValue: decodeScalar(userValue),
  };
}
