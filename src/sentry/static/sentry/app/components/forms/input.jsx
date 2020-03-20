import React from 'react';
import classNames from 'classnames';
import omit from 'lodash/omit';

export default function Input({className, ...otherProps}) {
  return (
    <input
      className={classNames('form-control', className)}
      {...omit(otherProps, 'children')}
    />
  );
}
