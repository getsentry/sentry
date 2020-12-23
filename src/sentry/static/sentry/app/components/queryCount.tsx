import React from 'react';
import PropTypes from 'prop-types';

import {defined} from 'app/utils';
import styled from 'app/styled';
import space from 'app/styles/space';

type Props = {
  count?: number;
  max?: number;
  hideIfEmpty?: boolean;
  hideParens?: boolean;
  backgroundColor?: string;
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
  backgroundColor,
}: Props) => {
  const countOrMax = defined(count) && defined(max) && count >= max ? `${max}+` : count;

  if (hideIfEmpty && !count) {
    return null;
  }

  if (backgroundColor) {
    return <StyledBackground backgroundColor={backgroundColor}>
      {countOrMax}
    </StyledBackground>;
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

const StyledBackground = styled('div')<{backgroundColor?: string}>`
  display: inline-flex;
  align-items: center;
  height: 20px;
  border-radius: 20px;
  color: ${p => p.theme.gray500};
  background-color: ${p => p.backgroundColor};
  padding: 0 ${space(1)};
  line-height: 20px;
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default QueryCount;
