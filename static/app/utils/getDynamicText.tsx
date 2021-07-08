import {IS_ACCEPTANCE_TEST, IS_TEST_ENV} from 'app/constants';

/**
 * Return a specified "fixed" string when we are in a testing environment
 * (more specifically, when `IS_ACCEPTANCE_TEST` is true)
 */
export default function getDynamicText<Value, Fixed = Value>({
  value,
  fixed,
  inTestEnv,
}: {
  value: Value;
  fixed: Fixed;
  inTestEnv?: boolean;
}): Value | Fixed {
  return IS_ACCEPTANCE_TEST || (inTestEnv && IS_TEST_ENV) ? fixed : value;
}
