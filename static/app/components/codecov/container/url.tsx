import type {Location} from 'history';

import type {CodecovContextTypes} from 'sentry/components/codecov/container/container';
import {defined} from 'sentry/utils';

// Types
type SingleParamValue = string | undefined | null;
type ParamValue = string[] | SingleParamValue;

// Constants
export const CODECOV_URL_PARAM = {
  REPOSITORY: 'repository',
};

// Functions
function getRepository(maybe: ParamValue) {
  if (!defined(maybe) || Array.isArray(maybe)) {
    return null;
  }

  return maybe;
}

export function getCodecovParamsFromQuery(query: Location['query']) {
  const repository = getRepository(query[CODECOV_URL_PARAM.REPOSITORY]);

  const state: CodecovContextTypes = {
    repository,
  };

  return state;
}
