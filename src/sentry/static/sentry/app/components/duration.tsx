import PropTypes from 'prop-types';
import React from 'react';

import {tn} from 'app/locale';

function roundWithFixed(
  value: number,
  fixedDigits: number
): {label: string; result: number} {
  const label = value.toFixed(fixedDigits);
  const result = fixedDigits <= 0 ? Math.round(value) : value;

  return {label, result};
}

function getDuration(
  seconds: number,
  fixedDigits: number = 0,
  abbreviation: boolean = false
): string {
  const value = Math.abs(seconds * 1000);

  if (value >= 604800000) {
    const {label, result} = roundWithFixed(value / 604800000, fixedDigits);
    return `${label} ${abbreviation ? 'wk' : tn('week', 'weeks', result)}`;
  }
  if (value >= 172800000) {
    const {label, result} = roundWithFixed(value / 86400000, fixedDigits);
    return `${label} ${abbreviation ? 'd' : tn('day', 'days', result)}`;
  }
  if (value >= 7200000) {
    const {label, result} = roundWithFixed(value / 3600000, fixedDigits);
    return `${label} ${abbreviation ? 'hr' : tn('hour', 'hours', result)}`;
  }
  if (value >= 120000) {
    const {label, result} = roundWithFixed(value / 60000, fixedDigits);
    return `${label} ${abbreviation ? 'min' : tn('minute', 'minutes', result)}`;
  }
  if (value >= 1000) {
    const {label, result} = roundWithFixed(value / 1000, fixedDigits);
    return `${label} ${abbreviation ? 's' : tn('second', 'seconds', result)}`;
  }

  const {label} = roundWithFixed(value, fixedDigits);

  return `${label}ms`;
}

type Props = React.HTMLProps<HTMLSpanElement> & {
  seconds: number;
  fixedDigits?: number;
  abbreviation?: boolean;
};

const Duration = ({seconds, fixedDigits, abbreviation, ...props}: Props) => (
  <span {...props}>{getDuration(seconds, fixedDigits, abbreviation)}</span>
);

Duration.propTypes = {
  seconds: PropTypes.number.isRequired,
  fixedDigits: PropTypes.number,
  abbreviation: PropTypes.bool,
};

export default Duration;
