/* global process */

// Return a specified "fixed" string when we are in a testing environment
// (more specifically in a PERCY env (e.g. CI))
export default function getDynamicText<Value, Fixed = Value>({
  value,
  fixed,
}: {
  value: Value;
  fixed: Fixed;
}): Value | Fixed {
  return process.env.IS_PERCY ? fixed : value;
}
