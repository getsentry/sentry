import * as React from 'react';

import {getDuration, getExactDuration} from 'app/utils/formatters';

type Props = React.HTMLProps<HTMLSpanElement> & {
  seconds: number;
  fixedDigits?: number;
  abbreviation?: boolean;
  exact?: boolean;
};

const Duration = ({seconds, fixedDigits, abbreviation, exact, ...props}: Props) => (
  <span {...props}>
    {exact
      ? getExactDuration(seconds, abbreviation)
      : getDuration(seconds, fixedDigits, abbreviation)}
  </span>
);

export default Duration;
