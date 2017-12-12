import React from 'react';
import classNames from 'classnames';

export default function Input({className, children, ...otherProps}) {
  return <input className={classNames('form-control', className)} {...otherProps} />;
}
