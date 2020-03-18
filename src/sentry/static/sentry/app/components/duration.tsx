import PropTypes from 'prop-types';
import React from 'react';

import {getDuration} from 'app/utils/formatters';

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
