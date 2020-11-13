import React from 'react';
import classNames from 'classnames';
import omit from 'lodash/omit';

type Props = {
  className?: string;
} & React.HTMLProps<HTMLInputElement>;

export default function Input({className, ...otherProps}: Props) {
  return (
    <input
      className={classNames('form-control', className)}
      {...omit(otherProps, 'children')}
    />
  );
}
