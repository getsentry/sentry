import React from 'react';
import PropTypes from 'prop-types';

import {defined} from 'app/utils';

import Tag from './tag';

type Props = {
  count?: number;
  max?: number;
  hideIfEmpty?: boolean;
  hideParens?: boolean;
  isTag?: boolean;
};

/**
 * Displays a number count. If `max` is specified, then give representation
 * of count, i.e. "1000+"
 *
 * Render nothing by default if `count` is falsy.
 */

const QueryCount = ({
  count,
  max,
  hideIfEmpty = true,
  hideParens = false,
  isTag = false,
}: Props) => {
  const countOrMax = defined(count) && defined(max) && count >= max ? `${max}+` : count;

  if (hideIfEmpty && !count) {
    return null;
  }

  if (isTag) {
    return <Tag>{countOrMax}</Tag>;
  }

  return (
    <span>
      {!hideParens && <span>(</span>}
      <span>{countOrMax}</span>
      {!hideParens && <span>)</span>}
    </span>
  );
};
QueryCount.propTypes = {
  count: PropTypes.number,
  max: PropTypes.number,
  hideIfEmpty: PropTypes.bool,
  hideParens: PropTypes.bool,
};

export default QueryCount;
