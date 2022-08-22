import {IS_ACCEPTANCE_TEST} from 'sentry/constants';

/**
 * Return a specified "fixed" string when we are in a testing environment
 * (more specifically, when `IS_ACCEPTANCE_TEST` is true)
 */
export default function getDynamicText<Value, Fixed = Value>({
  value,
  fixed,
}: {
  fixed: Fixed;
  value: Value;
}): Value | Fixed {
  return IS_ACCEPTANCE_TEST ? fixed : value;
}
