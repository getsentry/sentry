import IndicatorBadge from 'sentry/components/devtoolbar/components/indicatorBadge';

import useHasCustomFlagOverrides from './useHasCustomFlagOverrides';

export default function FlagOverridesBadge() {
  const hasOverrides = useHasCustomFlagOverrides();

  if (hasOverrides) {
    return <IndicatorBadge variant="red" />;
  }
  return null;
}
