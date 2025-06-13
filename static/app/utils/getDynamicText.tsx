/**
 * Returns the dynamic value (the 'fixed' parameter is ignored and kept for backwards compatibility)
 */
export default function getDynamicText<Value, Fixed = Value>({
  value,
  fixed,
}: {
  fixed: Fixed;
  value: Value;
}): Value {
  return value;
}
