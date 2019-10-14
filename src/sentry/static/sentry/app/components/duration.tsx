import PropTypes from 'prop-types';
import React from 'react';

import {tn} from 'app/locale';

function getDuration(seconds: number): string {
  const value = Math.abs(seconds * 1000);
  let result: number = 0;

  if (value >= 604800000) {
    result = Math.round(value / 604800000);
    return `${result} ${tn('week', 'weeks', result)}`;
  }
  if (value >= 172800000) {
    result = Math.round(value / 86400000);
    return `${result} ${tn('day', 'days', result)}`;
  }
  if (value >= 7200000) {
    result = Math.round(value / 3600000);
    return `${result} ${tn('hour', 'hours', result)}`;
  }
  if (value >= 120000) {
    result = Math.round(value / 60000);
    return `${result} ${tn('minute', 'minutes', result)}`;
  }
  if (value >= 1000) {
    result = Math.round(value / 1000);
    return `${result} ${tn('second', 'seconds', result)}`;
  }

  return Math.round(value) + ' ms';
}

type Props = React.HTMLProps<HTMLSpanElement> & {seconds: number};

const Duration = ({seconds, ...props}: Props) => (
  <span {...props}>{getDuration(seconds)}</span>
);

Duration.propTypes = {
  seconds: PropTypes.number.isRequired,
};

export default Duration;
