import {defined} from 'sentry/utils';

type Props = {
  count?: number | null;
  hideIfEmpty?: boolean;
  hideParens?: boolean;
  max?: number;
};

/**
 * Displays a number count. If `max` is specified, then give representation
 * of count, i.e. "1000+"
 *
 * Render nothing by default if `count` is falsy.
 */

function QueryCount({count, max, hideIfEmpty = true, hideParens = false}: Props) {
  const countOrMax = defined(count) && defined(max) && count >= max ? `${max}+` : count;

  if (hideIfEmpty && !count) {
    return null;
  }

  return (
    <span>
      {!hideParens && <span>(</span>}
      <span>{countOrMax}</span>
      {!hideParens && <span>)</span>}
    </span>
  );
}

export default QueryCount;
