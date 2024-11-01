import type {HTMLAttributes} from 'react';

import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  value: string | number;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>;

function Count({value, className, ...props}: Props) {
  return (
    <span className={className} title={value?.toLocaleString()} {...props}>
      {formatAbbreviatedNumber(value)}
    </span>
  );
}

export default Count;
