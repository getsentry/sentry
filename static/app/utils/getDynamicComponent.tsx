import {FunctionComponent} from 'react';

/**
 * Returns a replacement component, this function is mocked in tests and will use the second argument.
 * (This only happens during tests)
 */
export default function getDynamicComponent<Original extends FunctionComponent>({
  value,
}: {
  fixed: 'textarea';
  value: Original;
}): Original {
  // Overridden with fixed in tests.
  return value;
}
