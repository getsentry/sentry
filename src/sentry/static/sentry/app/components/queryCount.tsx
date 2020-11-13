import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import {defined} from 'app/utils';

type Props = {
  count?: number;
  max?: number;
  hideIfEmpty?: boolean;
  inline?: boolean;
  className?: string;
  hideParens?: boolean;
};

/**
 * Displays a number count. If `max` is specified, then give representation
 * of count, i.e. "1000+"
 *
 * Render nothing by default if `count` is falsy.
 */

const QueryCount = ({
  className,
  count,
  max,
  hideIfEmpty = true,
  inline = true,
  hideParens = false,
}: Props) => {
  const countOrMax = defined(count) && defined(max) && count >= max ? `${max}+` : count;
  const cx = classNames('query-count', className, {
    inline,
  });

  if (hideIfEmpty && !count) {
    return null;
  }

  return (
    <div className={cx}>
      {!hideParens && <span>(</span>}
      <span className="query-count-value">{countOrMax}</span>
      {!hideParens && <span>)</span>}
    </div>
  );
};
QueryCount.propTypes = {
  className: PropTypes.string,
  count: PropTypes.number,
  max: PropTypes.number,
  hideIfEmpty: PropTypes.bool,
  inline: PropTypes.bool,
  hideParens: PropTypes.bool,
};

export default QueryCount;
